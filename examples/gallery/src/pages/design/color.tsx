import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Border,
  Orientation,
  SolidColorBrush,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const palette = [
  { name: 'Blue', value: color(0, 120, 212) },
  { name: 'Purple', value: color(136, 23, 152) },
  { name: 'Teal', value: color(0, 153, 153) },
  { name: 'Orange', value: color(202, 80, 16) },
] as const

export function ColorPage(context: AppContext) {
  const selectedIndex = signal(0)
  const selectedSurface: RefObject<Border> = { current: null }
  const nativeStatus = signal('Native brush is mounted.')
  const brushes = palette.map((entry) =>
    createSolidColorBrush(SolidColorBrush, entry.value),
  )

  return (
    <Page
      title="Color"
      subtitle="Balanced color roles create clarity, hierarchy, and theme-aware contrast."
      automationId="ColorPageHeading"
      pageId="color"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDesignColorSample"
        title="An accent color palette"
        description="Typed Color structs and SolidColorBrush objects feed ordinary native background properties."
        code={`
const accent = createSolidColorBrush(
  SolidColorBrush,
  color(0, 120, 212),
)
<UI.Border background={accent} />
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignColorStatus"
              text={computed(
                () => `Selected color: ${palette[selectedIndex.value]?.name}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryDesignColorNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.Border
            ref={selectedSurface}
            height={120}
            background={computed(
              () => brushes[selectedIndex.value] ?? brushes[0]!,
            )}
          />
          <UI.StackPanel spacing={8}>
            {palette.map((entry, index) => (
              <UI.Button
                key={entry.name}
                automationId={`GalleryDesignColor${entry.name}`}
                padding={thickness(12)}
                onClick={() => {
                  selectedIndex.value = index
                  nativeStatus.value =
                    selectedSurface.current?.background
                      ? `Native brush applied for ${entry.name}.`
                      : 'Native brush is missing.'
                  context.model.recordInteraction()
                }}
              >
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={10}
                >
                  <UI.Border
                    width={28}
                    height={28}
                    background={brushes[index]!}
                  />
                  <UI.TextBlock text={entry.name} />
                </UI.StackPanel>
              </UI.Button>
            ))}
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
