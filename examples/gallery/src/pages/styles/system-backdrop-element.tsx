import {
  computed,
  cornerRadius,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  DesktopAcrylicBackdrop,
  MicaBackdrop,
  SystemBackdropElement,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { wasWindowBackdropRestored } from '../../backdrop-state'

export function SystemBackdropElementPage(context: AppContext) {
  const acrylic = new DesktopAcrylicBackdrop()
  const mica = new MicaBackdrop()
  const useMica = signal(false)
  const restoreStatus = signal('Window backdrop restore pending.')
  const nativeStatus = signal('Native element backdrop pending.')
  const element: RefObject<SystemBackdropElement> = {
    current: null,
  }
  const applyBackdrop = () => {
    const current = element.current
    if (!current) {
      throw new Error('SystemBackdropElement is not mounted.')
    }
    restoreStatus.value = wasWindowBackdropRestored()
      ? 'Window backdrop restored: yes'
      : 'Window backdrop restored: no'
    current.systemBackdrop =
      useMica.peek() ? mica : acrylic
    nativeStatus.value =
      current.systemBackdrop
        ? 'Native element backdrop assigned.'
        : 'Native element backdrop missing.'
  }

  return (
    <Page
      title="SystemBackdropElement"
      subtitle="Hosts system backdrop materials inside a specific UI region."
      automationId="SystemBackdropElementPageHeading"
      pageId="system-backdrop-element"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesSystemBackdropElementSample"
        title="Acrylic and Mica region"
        description="SystemBackdropElement owns content while its SystemBackdrop property switches materials."
        code={`
<UI.Grid>
  <UI.SystemBackdropElement ref={element} />
  <UI.Button>Content layered above the backdrop</UI.Button>
</UI.Grid>
element.current.systemBackdrop = backdrop
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesSystemBackdropElementStatus"
              text={computed(() =>
                useMica.value
                  ? 'Element backdrop: Mica'
                  : 'Element backdrop: Acrylic',
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesSystemBackdropRestoreStatus"
              text={restoreStatus}
            />
            <UI.TextBlock
              automationId="GalleryStylesSystemBackdropElementNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Button
            automationId="GalleryStylesSystemBackdropElementToggle"
            onClick={() => {
              useMica.value = !useMica.value
              applyBackdrop()
              context.model.recordInteraction()
            }}
          >
            Toggle backdrop
          </UI.Button>
        }
      >
        <UI.Grid width={360} height={220}>
          <UI.SystemBackdropElement
            ref={element}
            automationId="GalleryStylesSystemBackdropElementControl"
            width={360}
            height={220}
            cornerRadius={cornerRadius(12)}
            onLoaded={applyBackdrop}
          />
          <UI.Button>Backdrop content</UI.Button>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
