import {
  color,
  computed,
  createSolidColorBrush,
  createSymbolIcon,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  SolidColorBrush,
  Symbol,
  SymbolIcon,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GallerySelectorBar,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const sections = [
  {
    name: 'Recent',
    description: 'Items opened recently.',
    symbol: Symbol.Clock,
  },
  {
    name: 'Shared',
    description: 'Items shared with your team.',
    symbol: Symbol.Share,
  },
  {
    name: 'Favorites',
    description: 'Items marked as favorites.',
    symbol: Symbol.Favorite,
  },
] as const

export function SelectorBarPage(context: AppContext) {
  const selectedIndex = signal(0)
  const brushes = [
    createSolidColorBrush(
      SolidColorBrush,
      color(233, 244, 255),
    ),
    createSolidColorBrush(
      SolidColorBrush,
      color(237, 233, 254),
    ),
    createSolidColorBrush(
      SolidColorBrush,
      color(255, 242, 204),
    ),
  ] as const

  return (
    <Page
      title="SelectorBar"
      subtitle="Lets users switch between a small, finite set of views."
      automationId="SelectorBarPageHeading"
      pageId="selector-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GallerySelectorBarSample"
        title="Switch between related views"
        description="The controlled SelectorBar adapter maps native SelectedItem identity to a stable selected index."
        code={`
<GallerySelectorBar
  selectedIndex={selectedIndex}
  onSelectedIndexChange={(index) => {
    selectedIndex.value = index
  }}
>
  <UI.SelectorBarItem text="Recent" icon={clockIcon} />
  <UI.SelectorBarItem text="Shared" icon={shareIcon} />
  <UI.SelectorBarItem text="Favorites" icon={favoriteIcon} />
</GallerySelectorBar>
        `}
        output={
          <UI.TextBlock
            automationId="GallerySelectorBarStatus"
            text={computed(
              () =>
                `Selected: ${
                  sections[selectedIndex.value]?.name ?? 'None'
                }`,
            )}
          />
        }
        options={
          <GalleryComboBox
            automationId="GallerySelectorBarSelectedIndex"
            header={<UI.TextBlock text="Selected view" />}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={(index) => {
              selectedIndex.value = index
              context.model.recordInteraction()
            }}
            width={180}
          >
            {sections.map((section) => (
              <UI.TextBlock
                key={section.name}
                text={section.name}
              />
            ))}
          </GalleryComboBox>
        }
      >
        <UI.StackPanel spacing={16}>
          <GallerySelectorBar
            automationId="GallerySelectorBarControl"
            selectedIndex={selectedIndex}
            onSelectedIndexChange={(index) => {
              if (index !== selectedIndex.value) {
                selectedIndex.value = index
                context.model.recordInteraction()
              }
            }}
          >
            {sections.map((section) => (
              <UI.SelectorBarItem
                key={section.name}
                automationId={`GallerySelectorBar${section.name}`}
                text={section.name}
                icon={createSymbolIcon(
                  SymbolIcon,
                  section.symbol,
                )}
              />
            ))}
          </GallerySelectorBar>
          <UI.Border
            minHeight={160}
            padding={thickness(24)}
            background={computed(
              () =>
                brushes[selectedIndex.value] ?? brushes[0],
            )}
          >
            <UI.StackPanel spacing={8}>
              <UI.TextBlock
                fontSize={24}
                text={computed(
                  () =>
                    sections[selectedIndex.value]?.name ??
                    'None',
                )}
              />
              <UI.TextBlock
                text={computed(
                  () =>
                    sections[selectedIndex.value]
                      ?.description ?? '',
                )}
                textWrapping={TextWrapping.Wrap}
              />
            </UI.StackPanel>
          </UI.Border>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
