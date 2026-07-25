import {
  onCleanup,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  FileOpenPicker,
  IStorageFile,
  MediaPlayerElement,
  MediaSource,
  StorageFile,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { createGalleryAssetUri } from '../../gallery-assets'

export function MediaPlayerElementPage(context: AppContext) {
  const player1: RefObject<MediaPlayerElement> = { current: null }
  const player2: RefObject<MediaPlayerElement> = { current: null }
  const status = signal('Bundled media sources are ready.')
  let mountedPlayer1: MediaPlayerElement | null = null
  let mountedPlayer2: MediaPlayerElement | null = null
  let disposed = false
  let firstSource = MediaSource.createFromUri(
    createGalleryAssetUri('SampleMedia/ladybug.wmv'),
  )
  const secondSource = MediaSource.createFromUri(
    createGalleryAssetUri('SampleMedia/fishes.wmv'),
  )
  const openFile = async () => {
    if (!mountedPlayer1) {
      throw new Error('The media player is not mounted.')
    }
    status.value = 'Opening the native media file picker...'
    try {
      const picker = new FileOpenPicker(context.window.appWindow.id)
      picker.fileTypeFilter.append('.wmv')
      picker.fileTypeFilter.append('.mp4')
      picker.fileTypeFilter.append('.mp3')
      const result = await picker.pickSingleFileAsync()
      if (!result || disposed) {
        status.value = disposed
          ? status.value
          : 'File selection canceled.'
        return
      }
      const file = await StorageFile.getFileFromPathAsync(
        result.path,
      )
      const nextSource = MediaSource.createFromStorageFile(
        file.as(IStorageFile),
      )
      if (disposed) {
        nextSource.close()
        return
      }
      const previous = firstSource
      try {
        mountedPlayer1.source = nextSource
      }
      catch (error: unknown) {
        nextSource.close()
        throw error
      }
      firstSource = nextSource
      previous.close()
      status.value = `Selected media: ${file.name}`
      context.model.recordInteraction()
    }
    catch (error: unknown) {
      if (!disposed) {
        status.value = `Media picker unavailable: ${String(error)}`
      }
    }
  }
  onCleanup(() => {
    disposed = true
    let firstError: unknown
    let firstDetached = mountedPlayer1 === null
    let secondDetached = mountedPlayer2 === null
    for (const player of [mountedPlayer1, mountedPlayer2]) {
      try {
        if (player) {
          player.mediaPlayer.pause()
        }
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    try {
      if (mountedPlayer1) {
        mountedPlayer1.setValue(
          MediaPlayerElement.sourceProperty,
          null,
        )
      }
      firstDetached = true
    }
    catch (error: unknown) {
      firstError ??= error
    }
    try {
      if (mountedPlayer2) {
        mountedPlayer2.setValue(
          MediaPlayerElement.sourceProperty,
          null,
        )
      }
      secondDetached = true
    }
    catch (error: unknown) {
      firstError ??= error
    }
    for (const [source, detached] of [
      [firstSource, firstDetached],
      [secondSource, secondDetached],
    ] as const) {
      if (!detached) {
        continue
      }
      try {
        source.close()
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
      title="MediaPlayerElement"
      subtitle="A control to display video and image content."
      automationId="MediaPlayerElementPageHeading"
      pageId="media-player-element"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaPlayerTransportSample"
        title="MediaPlayerElement with transport controls"
        description="The first player starts paused and exposes the built-in transport controls. A native file picker can replace its source."
        code={`<UI.MediaPlayerElement
  source={ladybugSource}
  areTransportControlsEnabled
  autoPlay={false}
/>`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaPlayerStatus"
            text={status}
          />
        }
        options={
          <UI.Button
            automationId="GalleryMediaPlayerOpenFile"
            onClick={() => {
              void openFile()
            }}
          >
            Open a file
          </UI.Button>
        }
      >
        <UI.MediaPlayerElement
          ref={(value) => {
            player1.current = value
            if (value) {
              mountedPlayer1 = value
            }
          }}
          automationId="GalleryMediaPlayerTransport"
          maxWidth={400}
          areTransportControlsEnabled
          autoPlay={false}
          source={firstSource}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaPlayerAutoplaySample"
        title="Autoplay video"
        description="The second player starts its bundled source automatically and is paused when the page is disposed."
        code={`<UI.MediaPlayerElement
  source={fishesSource}
  autoPlay
/>`}
      >
        <UI.MediaPlayerElement
          ref={(value) => {
            player2.current = value
            if (value) {
              mountedPlayer2 = value
            }
          }}
          automationId="GalleryMediaPlayerAutoplay"
          maxWidth={400}
          autoPlay
          source={secondSource}
        />
      </SampleCard>
    </Page>
  )
}
