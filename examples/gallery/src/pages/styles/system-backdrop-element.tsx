import {
  computed,
  cornerRadius,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  DesktopAcrylicBackdrop,
  MicaBackdrop,
  MicaKind,
  SystemBackdropElement,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { wasWindowBackdropRestored } from '../../backdrop-state'

const backdropNames = ['Acrylic', 'Mica', 'Mica Alt'] as const

export function SystemBackdropElementPage(context: AppContext) {
  const acrylic = new DesktopAcrylicBackdrop()
  const mica = new MicaBackdrop()
  const micaAlt = new MicaBackdrop()
  micaAlt.kind = MicaKind.BaseAlt
  const backdrops = [acrylic, mica, micaAlt] as const
  const backdropIndex = signal(0)
  const radius = signal(8)
  const restoreStatus = signal('Window backdrop restore pending.')
  const nativeStatus = signal('Native element backdrop pending.')
  const element: RefObject<SystemBackdropElement> = {
    current: null,
  }
  const radiusSlider: RefObject<SliderInstance> = { current: null }
  const applyBackdrop = () => {
    const current = element.current
    if (!current) {
      throw new Error('SystemBackdropElement is not mounted.')
    }
    restoreStatus.value = wasWindowBackdropRestored()
      ? 'Window backdrop restored: yes'
      : 'Window backdrop restored: no'
    current.systemBackdrop =
      backdrops[backdropIndex.value] ?? acrylic
    current.cornerRadius = cornerRadius(radius.value)
    nativeStatus.value =
      current.systemBackdrop
        ? `Native element backdrop assigned; radius ${current.cornerRadius.topLeft}.`
        : 'Native element backdrop missing.'
  }

  return (
    <Page
      title="SystemBackdropElement"
      subtitle="An element to host system backdrop materials."
      automationId="SystemBackdropElementPageHeading"
      pageId="system-backdrop-element"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesSystemBackdropElementSample"
        title="Backdrop type and corner radius"
        description="SystemBackdropElement stays behind sibling content while its backdrop and radius update natively."
        code={`
element.systemBackdrop = backdrop
element.cornerRadius = cornerRadius(radius)
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesSystemBackdropElementStatus"
              text={computed(
                () => `Element backdrop: ${backdropNames[backdropIndex.value]}`,
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
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              header="Backdrop Type"
              selectedIndex={backdropIndex}
              onSelectedIndexChange={(index) => {
                backdropIndex.value = index
                applyBackdrop()
                context.model.recordInteraction()
              }}
            >
              {backdropNames.map((name) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.Slider
              ref={radiusSlider}
              header="Corner radius"
              minimum={0}
              maximum={50}
              stepFrequency={1}
              value={8}
              onValueChanged={() => {
                radius.value =
                  radiusSlider.current?.value ?? radius.value
                applyBackdrop()
              }}
            />
            <UI.Button
              automationId="GalleryStylesSystemBackdropElementToggle"
              onClick={() => {
                backdropIndex.value =
                  (backdropIndex.value + 1) % backdrops.length
                applyBackdrop()
                context.model.recordInteraction()
              }}
            >
              Next backdrop
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Grid width={300} height={200}>
          <UI.SystemBackdropElement
            ref={element}
            automationId="GalleryStylesSystemBackdropElementControl"
            width={300}
            height={200}
            cornerRadius={cornerRadius(8)}
            onLoaded={applyBackdrop}
          />
          <UI.Button>Click Me</UI.Button>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
