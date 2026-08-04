import {
  onCleanup,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AnimatedSettingsVisualSource,
  AnimatedVisualPlayer,
  Orientation,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AnimatedVisualPlayerPage(context: AppContext) {
  const player: RefObject<AnimatedVisualPlayer> = { current: null }
  const source = context.createProjected(
    () => new AnimatedSettingsVisualSource(),
  )
  const paused = signal(false)
  const status = signal('Animation ready.')
  let mountedPlayer: AnimatedVisualPlayer | null = null
  let playGeneration = 0
  let activePlayGeneration = 0
  const requirePlayer = () => {
    if (!mountedPlayer) {
      throw new Error('AnimatedVisualPlayer is not mounted.')
    }
    return mountedPlayer
  }
  const play = (rate: number) => {
    const current = requirePlayer()
    current.playbackRate = rate
    paused.value = false
    if (!current.isPlaying) {
      const generation = ++playGeneration
      activePlayGeneration = generation
      void current.playAsync(0, 1, false).then(
        () => {
          if (activePlayGeneration === generation) {
            activePlayGeneration = 0
            status.value = 'Animation completed.'
          }
        },
        (error: unknown) => {
          if (activePlayGeneration === generation) {
            activePlayGeneration = 0
            status.value = `Animation failed: ${String(error)}`
          }
        },
      )
    }
    status.value = rate < 0
      ? 'Animation playing in reverse.'
      : 'Animation playing forward.'
    context.model.recordInteraction()
  }
  onCleanup(() => {
    activePlayGeneration = 0
    mountedPlayer = null
  })

  return (
    <Page
      title="AnimatedVisualPlayer"
      subtitle="An element to render and control playback of motion graphics."
      automationId="AnimatedVisualPlayerPageHeading"
      pageId="animated-visual-player"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaAnimatedVisualPlayerSample"
        title="Playback of a generated animation"
        description="The original Gallery uses a Lottie-generated source. This TSX version uses a generated WinUI composition visual source with the same playback controls."
        code={`const source = new AnimatedSettingsVisualSource()

<UI.AnimatedVisualPlayer
  source={source}
  autoPlay={false}
/>`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaAnimatedVisualPlayerStatus"
            text={status}
          />
        }
        options={
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
          >
            <UI.Button
              automationId="GalleryMediaAnimatedVisualPlayerPlay"
              onClick={() => play(1)}
            >
              Play
            </UI.Button>
            <UI.ToggleButton
              automationId="GalleryMediaAnimatedVisualPlayerPause"
              isChecked={paused}
              onChecked={() => {
                requirePlayer().pause()
                paused.value = true
                status.value = 'Animation paused.'
                context.model.recordInteraction()
              }}
              onUnchecked={() => {
                requirePlayer().resume()
                paused.value = false
                status.value = 'Animation resumed.'
                context.model.recordInteraction()
              }}
            >
              Pause
            </UI.ToggleButton>
            <UI.Button
              automationId="GalleryMediaAnimatedVisualPlayerStop"
              onClick={() => {
                activePlayGeneration = 0
                requirePlayer().stop()
                paused.value = false
                status.value = 'Animation stopped.'
                context.model.recordInteraction()
              }}
            >
              Stop
            </UI.Button>
            <UI.Button
              automationId="GalleryMediaAnimatedVisualPlayerReverse"
              onClick={() => play(-1)}
            >
              Reverse
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Border
          width={400}
          height={400}
          borderThickness={{
            left: 1,
            top: 1,
            right: 1,
            bottom: 1,
          }}
        >
          <UI.AnimatedVisualPlayer
            ref={(value) => {
              player.current = value
              mountedPlayer = value
            }}
            automationId="GalleryMediaAnimatedVisualPlayer"
            source={source}
            autoPlay={false}
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
