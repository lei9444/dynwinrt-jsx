import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Orientation,
  PipsPager,
  PipsPagerButtonVisibility,
  PipsPagerWrapMode,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const orientations = [
  { name: 'Horizontal', value: Orientation.Horizontal },
  { name: 'Vertical', value: Orientation.Vertical },
] as const

export function PipsPagerPage(context: AppContext) {
  const selectedIndex = signal(0)
  const orientationIndex = signal(0)
  const wrap = signal(false)
  const wrapToggle: RefObject<ToggleInstance> = { current: null }

  return (
    <Page
      title="PipsPager"
      subtitle="Navigates paginated content with compact glyph indicators."
      automationId="PipsPagerPageHeading"
      pageId="pips-pager"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryPipsPagerSample"
        title="Navigate eight pages"
        description="Selection, orientation, navigation-button visibility, and wrap mode remain native PipsPager properties."
        code={`
<UI.PipsPager
  numberOfPages={8}
  selectedPageIndex={selectedIndex}
  previousButtonVisibility={PipsPagerButtonVisibility.Visible}
  nextButtonVisibility={PipsPagerButtonVisibility.Visible}
  onSelectedIndexChanged={(sender) => {
    selectedIndex.value = sender.selectedPageIndex
  }}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryPipsPagerStatus"
            text={computed(
              () => `Page ${selectedIndex.value + 1} of 8 selected`,
            )}
          />
        }
        options={
          <UI.StackPanel spacing={10}>
            <GalleryComboBox
              automationId="GalleryPipsPagerOrientation"
              header={<UI.TextBlock text="Orientation" />}
              selectedIndex={orientationIndex}
              onSelectedIndexChange={(index) => {
                orientationIndex.value = index
                context.model.recordInteraction()
              }}
              width={180}
            >
              {orientations.map((orientation) => (
                <UI.TextBlock
                  key={orientation.name}
                  text={orientation.name}
                />
              ))}
            </GalleryComboBox>
            <UI.ToggleSwitch
              ref={wrapToggle}
              automationId="GalleryPipsPagerWrap"
              header="Wrap navigation"
              onToggled={() => {
                const next =
                  wrapToggle.current?.isOn ?? wrap.value
                if (next !== wrap.value) {
                  wrap.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={18}>
          <UI.Border
            minHeight={160}
            padding={thickness(28)}
          >
            <UI.TextBlock
              fontSize={32}
              text={computed(
                () => `Page ${selectedIndex.value + 1}`,
              )}
            />
          </UI.Border>
          <UI.PipsPager
            automationId="GalleryPipsPagerControl"
            numberOfPages={8}
            maxVisiblePips={5}
            selectedPageIndex={selectedIndex}
            orientation={computed(
              () =>
                orientations[orientationIndex.value]?.value ??
                Orientation.Horizontal,
            )}
            previousButtonVisibility={
              PipsPagerButtonVisibility.Visible
            }
            nextButtonVisibility={
              PipsPagerButtonVisibility.Visible
            }
            wrapMode={computed(() =>
              wrap.value
                ? PipsPagerWrapMode.Wrap
                : PipsPagerWrapMode.None,
            )}
            onSelectedIndexChanged={(sender: PipsPager) => {
              if (
                sender.selectedPageIndex !== selectedIndex.value
              ) {
                selectedIndex.value = sender.selectedPageIndex
                context.model.recordInteraction()
              }
            }}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
