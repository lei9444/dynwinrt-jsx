import {
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AnimatedFindVisualSource,
  AnimatedIcon,
  Symbol,
  SymbolIconSource,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AnimatedIconPage(context: AppContext) {
  const icon: RefObject<AnimatedIcon> = { current: null }
  const status = signal('AnimatedIcon state: Normal')
  const source = new AnimatedFindVisualSource()
  const fallback = new SymbolIconSource()
  fallback.symbol = Symbol.Find

  const setState = (state: string) => {
    const current = icon.current
    if (!current) {
      throw new Error('AnimatedIcon is not mounted.')
    }
    AnimatedIcon.setState(current, state)
    status.value =
      `AnimatedIcon state: ${AnimatedIcon.getState(current)}`
  }

  return (
    <Page
      title="AnimatedIcon"
      subtitle="Transitions between named visual states with a static fallback."
      automationId="AnimatedIconPageHeading"
      pageId="animated-icon"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesAnimatedIconSample"
        title="Animated search icon"
        description="The built-in AnimatedFindVisualSource responds to PointerOver and Normal states."
        code={`
<UI.AnimatedIcon
  source={new AnimatedFindVisualSource()}
  fallbackIconSource={fallback}
/>
AnimatedIcon.setState(icon, 'PointerOver')
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesAnimatedIconStatus"
            text={status}
          />
        }
        options={
          <UI.Button
            automationId="GalleryStylesAnimatedIconToggle"
            onClick={() => {
              setState(
                status.peek().endsWith('Normal')
                  ? 'PointerOver'
                  : 'Normal',
              )
              context.model.recordInteraction()
            }}
          >
            Toggle animation state
          </UI.Button>
        }
      >
        <UI.AnimatedIcon
          ref={icon}
          automationId="GalleryStylesAnimatedIconControl"
          width={64}
          height={64}
          source={source}
          fallbackIconSource={fallback}
        />
      </SampleCard>
    </Page>
  )
}
