import {
  computed,
  createSymbolIcon,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import { Symbol, SymbolIcon } from '#winapp/bindings'
import {
  type AppBarToggleButtonInstance,
  type AppContext,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AppBarToggleButtonPage(context: AppContext) {
  const toggleRef: RefObject<AppBarToggleButtonInstance> = {
    current: null,
  }
  const pinned = signal(false)

  return (
    <Page
      title="AppBarToggleButton"
      subtitle="An app bar command that preserves checked state."
      automationId="AppBarToggleButtonPageHeading"
      pageId="app-bar-toggle-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusAppBarToggleButtonSample"
        title="Toggle a persistent app bar command"
        description="Read the native checked state after Click and keep application state synchronized."
        code={`
<UI.AppBarToggleButton
  icon={createSymbolIcon(SymbolIcon, Symbol.Pin)}
  label="Pin"
  isChecked={pinned}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAppBarToggleButtonStatus"
            text={computed(() =>
              pinned.value ? 'Pinned.' : 'Not pinned.',
            )}
          />
        }
      >
        <UI.AppBarToggleButton
          ref={toggleRef}
          automationId="GalleryAppBarToggleButtonControl"
          icon={createSymbolIcon(SymbolIcon, Symbol.Pin)}
          label="Pin"
          toolTip="Pin this item"
          isChecked={pinned}
          onClick={() => {
            const next = toggleRef.current?.isChecked === true
            if (next !== pinned.value) {
              pinned.value = next
              context.model.recordInteraction()
            }
          }}
        />
      </SampleCard>
    </Page>
  )
}
