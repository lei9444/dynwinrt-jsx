import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  ElementSoundKind,
  ElementSoundMode,
  ElementSoundPlayer,
  ElementSoundPlayerState,
  ElementSpatialAudioMode,
} from '#winapp/bindings'
import {
  type AppContext,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const sounds = [
  ['Focus', ElementSoundKind.Focus],
  ['Invoke', ElementSoundKind.Invoke],
  ['Show', ElementSoundKind.Show],
  ['Hide', ElementSoundKind.Hide],
  ['MovePrevious', ElementSoundKind.MovePrevious],
  ['MoveNext', ElementSoundKind.MoveNext],
  ['GoBack', ElementSoundKind.GoBack],
] as const

export function SoundPage(context: AppContext) {
  const soundOn = signal(
    ElementSoundPlayer.state === ElementSoundPlayerState.On,
  )
  const spatialOn = signal(
    soundOn.value &&
      ElementSoundPlayer.spatialAudioMode ===
        ElementSpatialAudioMode.On,
  )
  const status = signal(
    soundOn.value ? 'UI sound is on.' : 'UI sound is off.',
  )
  const soundToggle: RefObject<ToggleInstance> = { current: null }
  const setSound = (enabled: boolean) => {
    soundOn.value = enabled
    ElementSoundPlayer.put_State(
      enabled
        ? ElementSoundPlayerState.On
        : ElementSoundPlayerState.Off,
    )
    if (!enabled) {
      spatialOn.value = false
      ElementSoundPlayer.put_SpatialAudioMode(
        ElementSpatialAudioMode.Off,
      )
    }
    status.value = enabled ? 'UI sound is on.' : 'UI sound is off.'
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Sound"
      subtitle="A code-behind API that enables 2D and 3D UI sounds on XAML controls."
      automationId="SoundPageHeading"
      pageId="sound"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaSoundToggleSample"
        title="Toggle UI sound"
        description="ElementSoundPlayer.State controls whether WinUI control sounds play."
        code={`ElementSoundPlayer.put_State(
  enabled
    ? ElementSoundPlayerState.On
    : ElementSoundPlayerState.Off,
)`}
      >
        <UI.ToggleSwitch
          ref={soundToggle}
          automationId="GalleryMediaSoundToggle"
          isOn={soundOn}
          onContent="Sound On"
          offContent="Sound Off"
          onToggled={() => setSound(
            soundToggle.current?.isOn ?? soundOn.value,
          )}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaSpatialSoundSample"
        title="Toggle spatial audio"
        description="Spatial audio can be enabled only while UI sound is on."
        code={`ElementSoundPlayer.put_SpatialAudioMode(
  ElementSpatialAudioMode.On,
)`}
      >
        <UI.StackPanel spacing={5}>
          <UI.CheckBox
            automationId="GalleryMediaSpatialSoundToggle"
            isEnabled={soundOn}
            isChecked={spatialOn}
            onChecked={() => {
              spatialOn.value = true
              ElementSoundPlayer.put_SpatialAudioMode(
                ElementSpatialAudioMode.On,
              )
              status.value = 'Spatial audio is on.'
              context.model.recordInteraction()
            }}
            onUnchecked={() => {
              spatialOn.value = false
              ElementSoundPlayer.put_SpatialAudioMode(
                ElementSpatialAudioMode.Off,
              )
              status.value = 'Spatial audio is off.'
              context.model.recordInteraction()
            }}
          >
            Enable Spatial Audio
          </UI.CheckBox>
          <UI.TextBlock
            text="Spatial audio can only be enabled when sound is on."
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaSystemSoundSample"
        title="Play a specific system sound"
        description="Play each built-in ElementSoundKind without also playing the button's normal invoke sound."
        code={`ElementSoundPlayer.play(ElementSoundKind.Focus)`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaSoundStatus"
            text={computed(() => status.value)}
          />
        }
      >
        <UI.StackPanel spacing={5}>
          {sounds.map(([name, sound]) => (
            <UI.Button
              key={name}
              automationId={`GalleryMediaSound${name}`}
              automationName={name}
              elementSoundMode={ElementSoundMode.Off}
              onClick={() => {
                ElementSoundPlayer.play(sound)
                status.value = `Played ${name} sound.`
                context.model.recordInteraction()
              }}
            >
              {`▶ ${name}`}
            </UI.Button>
          ))}
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
