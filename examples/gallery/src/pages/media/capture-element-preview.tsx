import {
  For,
  createUri,
  gridLength,
  onCleanup,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  BitmapImage,
  HorizontalAlignment,
  ImageEncodingProperties,
  InMemoryRandomAccessStream,
  Launcher,
  MediaCapture,
  MediaCaptureInitializationSettings,
  MediaCaptureMemoryPreference,
  MediaCaptureSharingMode,
  MediaFrameSourceKind,
  MediaFrameSourceGroup,
  MediaPlayerElement,
  MediaSource,
  MediaStreamType,
  ScaleTransform,
  StreamingCaptureMode,
  Stretch,
  UIElement,
  Uri,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

type CameraAbortSignal = NonNullable<
  Parameters<typeof MediaFrameSourceGroup.findAllAsync>[0]
>

declare const AbortController: {
  new(): {
    readonly signal: CameraAbortSignal
    abort(): void
  }
}

export function CaptureElementPreviewPage(context: AppContext) {
  const preview: RefObject<MediaPlayerElement> = { current: null }
  const status = signal('Camera preview not started.')
  const starting = signal(false)
  const ready = signal(false)
  const mirrored = signal(false)
  const mirrorToggle: RefObject<ToggleInstance> = { current: null }
  const snapshots = signal<readonly BitmapImage[]>([])
  const abort = new AbortController()
  const mirrorTransform = new ScaleTransform()
  mirrorTransform.scaleX = -1
  let mountedPreview: MediaPlayerElement | null = null
  let mediaCapture: MediaCapture | null = null
  let mediaSource: MediaSource | null = null
  let disposed = false
  const startPreview = async () => {
    if (starting.value || ready.value) {
      return
    }
    const host = mountedPreview
    if (!host) {
      throw new Error('Camera preview host is not mounted.')
    }
    starting.value = true
    status.value = 'Looking for camera devices...'
    let pendingCapture: MediaCapture | null = null
    try {
      const groups = await MediaFrameSourceGroup.findAllAsync(
        abort.signal,
      )
      if (disposed) {
        return
      }
      const sources = groups.toArray().flatMap((group) =>
        group.sourceInfos.toArray().map((info) => ({ group, info })),
      )
      const selected = sources.find(({ info }) =>
        info.sourceKind === MediaFrameSourceKind.Color &&
        info.mediaStreamType === MediaStreamType.VideoPreview,
      ) ?? sources.find(({ info }) =>
        info.sourceKind === MediaFrameSourceKind.Color &&
        info.mediaStreamType === MediaStreamType.VideoRecord,
      )
      if (!selected) {
        status.value = 'No camera devices found.'
        return
      }
      const { group, info: sourceInfo } = selected
      pendingCapture = new MediaCapture()
      const settings = new MediaCaptureInitializationSettings()
      settings.sourceGroup = group
      settings.sharingMode = sourceInfo.isShareable
        ? MediaCaptureSharingMode.SharedReadOnly
        : MediaCaptureSharingMode.ExclusiveControl
      settings.streamingCaptureMode = StreamingCaptureMode.Video
      settings.memoryPreference = MediaCaptureMemoryPreference.Cpu
      await pendingCapture.initializeAsync(settings, abort.signal)
      if (disposed) {
        return
      }
      const frameSource = pendingCapture.frameSources.get(sourceInfo.id)
      if (!frameSource) {
        status.value = 'The selected camera frame source is unavailable.'
        return
      }
      const source = MediaSource.createFromMediaFrameSource(frameSource)
      try {
        host.source = source
      }
      catch (error: unknown) {
        source.close()
        throw error
      }
      mediaCapture = pendingCapture
      pendingCapture = null
      mediaSource = source
      ready.value = true
      status.value = `Viewing: ${group.displayName}`
      context.model.recordInteraction()
    }
    catch (error: unknown) {
      if (!disposed) {
        const message = String(error)
        status.value = /access|denied|unauthorized/i.test(message)
          ? 'Camera access denied. Enable camera access in Windows privacy settings.'
          : `Camera unavailable: ${message}`
      }
    }
    finally {
      pendingCapture?.close()
      if (!disposed) {
        starting.value = false
      }
    }
  }
  const setMirrored = (value: boolean) => {
    mirrored.value = value
    const host = mountedPreview
    if (host) {
      if (value) {
        host.renderTransform = mirrorTransform
        host.renderTransformOrigin = { x: 0.5, y: 0.5 }
      }
      else {
        host.setValue(UIElement.renderTransformProperty, null)
      }
    }
    context.model.recordInteraction()
  }
  const capturePhoto = async () => {
    const capture = mediaCapture
    if (!capture) {
      status.value = 'Start the camera preview before capturing a photo.'
      return
    }
    const stream = new InMemoryRandomAccessStream()
    try {
      await capture.capturePhotoToStreamAsync(
        ImageEncodingProperties.createJpeg(),
        stream,
        abort.signal,
      )
      stream.seek(0n)
      const image = new BitmapImage()
      image.decodePixelWidth = 192
      await image.setSourceAsync(stream, abort.signal)
      if (!disposed) {
        snapshots.value = [image, ...snapshots.value].slice(0, 8)
        status.value = 'Photo successfully captured.'
        context.model.recordInteraction()
      }
    }
    catch (error: unknown) {
      if (!disposed) {
        status.value = `Photo capture failed: ${String(error)}`
      }
    }
    finally {
      stream.close()
    }
  }
  onCleanup(() => {
    disposed = true
    abort.abort()
    let firstError: unknown
    let detached = mountedPreview === null
    try {
      if (mountedPreview) {
        mountedPreview.mediaPlayer.pause()
      }
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      if (mountedPreview) {
        mountedPreview.setValue(MediaPlayerElement.sourceProperty, null)
      }
      detached = true
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (detached) {
      try {
        mediaSource?.close()
        mediaSource = null
      }
      catch (error: unknown) {
        firstError ??= error
      }
      try {
        mediaCapture?.close()
        mediaCapture = null
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })

  return (
    <Page
      title="Capture Element / Camera Preview"
      subtitle="A sample for doing a camera preview."
      automationId="CaptureElementPreviewPageHeading"
      pageId="capture-element-preview"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaCameraSample"
        title="MediaCapture preview displayed through MediaPlayerElement"
        description="Camera hardware and Windows privacy permission are required. Missing devices or denied permission are reported explicitly."
        code={`const groups = await MediaFrameSourceGroup.findAllAsync()
await mediaCapture.initializeAsync(settings)
preview.source = MediaSource.createFromMediaFrameSource(frameSource)`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaCameraStatus"
            text={status}
          />
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.Button
              automationId="GalleryMediaCameraStart"
              isEnabled={signal(true)}
              onClick={() => {
                void startPreview()
              }}
            >
              Start camera preview
            </UI.Button>
            <UI.ToggleSwitch
              ref={mirrorToggle}
              automationId="GalleryMediaCameraMirror"
              header="Mirror preview"
              isOn={mirrored}
              onToggled={() => setMirrored(
                mirrorToggle.current?.isOn ?? mirrored.value,
              )}
            />
            <UI.Button
              automationId="GalleryMediaCameraCapture"
              isEnabled={ready}
              onClick={() => {
                void capturePhoto()
              }}
            >
              Capture Photo
            </UI.Button>
            <UI.Button
              automationId="GalleryMediaCameraPrivacy"
              onClick={() => {
                void Launcher.launchUriAsync(
                  createUri(Uri, 'ms-settings:privacy-webcam'),
                ).then(
                  (opened) => {
                    status.value = opened
                      ? 'Camera privacy settings opened.'
                      : 'Windows could not open camera privacy settings.'
                  },
                  (error: unknown) => {
                    status.value =
                      `Camera privacy settings unavailable: ${String(error)}`
                  },
                )
              }}
            >
              Privacy Settings
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <LayoutGrid
          minWidth={400}
          minHeight={300}
          columnDefinitions={[
            gridLength.star(),
            gridLength.pixel(100),
          ]}
          rowDefinitions={[
            gridLength.auto(),
            gridLength.star(),
          ]}
          columnSpacing={4}
          rowSpacing={10}
        >
          <UI.TextBlock
            text={status}
            verticalAlignment={1}
          />
          <UI.MediaPlayerElement
            ref={(value) => {
              preview.current = value
              if (value) {
                mountedPreview = value
              }
            }}
            automationId="GalleryMediaCameraPreview"
            gridRow={1}
            autoPlay
            stretch={Stretch.Uniform}
          />
          <UI.TextBlock
            gridColumn={1}
            text="Captured:"
            horizontalAlignment={HorizontalAlignment.Left}
          />
          <UI.ScrollViewer gridRow={1} gridColumn={1}>
            <UI.StackPanel spacing={2}>
              <For
                each={snapshots}
                key={(source) => source}
              >
                {(source) => (
                  <UI.Image
                    width={96}
                    source={source}
                  />
                )}
              </For>
            </UI.StackPanel>
          </UI.ScrollViewer>
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
