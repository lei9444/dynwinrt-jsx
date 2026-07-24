import { onCleanup, signal } from 'dynwinrt-jsx'
import {
  DesktopAcrylicBackdrop,
  MicaBackdrop,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { markWindowBackdropRestored } from '../../backdrop-state'

export function SystemBackdropsPage(context: AppContext) {
  const original = context.window.systemBackdrop
  const mica = new MicaBackdrop()
  const acrylic = new DesktopAcrylicBackdrop()
  const status = signal('Window backdrop: Mica')
  onCleanup(() => {
    context.window.systemBackdrop = original
    markWindowBackdropRestored()
  })

  return (
    <Page
      title="System Backdrops"
      subtitle="Applies Mica or Desktop Acrylic to the app window."
      automationId="SystemBackdropsPageHeading"
      pageId="system-backdrops"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesSystemBackdropsSample"
        title="Switch the window material"
        description="The page restores the original Window.SystemBackdrop when its scope is disposed."
        code={`
window.systemBackdrop = new MicaBackdrop()
window.systemBackdrop = new DesktopAcrylicBackdrop()
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesSystemBackdropsStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.Button
            automationId="GalleryStylesSystemBackdropsMica"
            onClick={() => {
              context.window.systemBackdrop = mica
              status.value = 'Window backdrop: Mica'
              context.model.recordInteraction()
            }}
          >
            Use Mica
          </UI.Button>
          <UI.Button
            automationId="GalleryStylesSystemBackdropsAcrylic"
            onClick={() => {
              context.window.systemBackdrop = acrylic
              status.value = 'Window backdrop: Desktop Acrylic'
              context.model.recordInteraction()
            }}
          >
            Use Desktop Acrylic
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
