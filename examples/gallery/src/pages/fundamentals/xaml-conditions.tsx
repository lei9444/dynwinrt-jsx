import {
  Show,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function XamlConditionsPage(context: AppContext) {
  const enabled = signal(false)
  const toggle: RefObject<ToggleInstance> = { current: null }

  return (
    <Page
      title="XAML Conditions"
      subtitle="Conditionally owns native branches from application state."
      automationId="XamlConditionsPageHeading"
      pageId="xaml-conditions"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryXamlConditionsSample"
        title="A feature-flag condition"
        description="Show is the reactive TSX equivalent for runtime conditional markup and owns branch cleanup."
        code={`
<Show when={featureEnabled} fallback={<DisabledView />}>
  <EnabledView />
</Show>
        `}
        options={
          <UI.ToggleSwitch
            ref={toggle}
            automationId="GalleryXamlConditionsToggle"
            header="Enable feature"
            onToggled={() => {
              enabled.value =
                toggle.current?.isOn ?? enabled.value
              context.model.recordInteraction()
            }}
          />
        }
      >
        <Show
          when={enabled}
          fallback={
            <UI.TextBlock
              automationId="GalleryXamlConditionsDisabled"
              text="Disabled branch active."
            />
          }
        >
          <UI.TextBlock
            automationId="GalleryXamlConditionsEnabled"
            text="Enabled branch active."
          />
        </Show>
      </SampleCard>
    </Page>
  )
}
