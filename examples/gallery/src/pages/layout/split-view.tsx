import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  NumberBoxSpinButtonPlacementMode,
  SolidColorBrush,
  SplitViewDisplayMode,
  SplitViewPanePlacement,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GallerySplitView,
  type NumberBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const displayModes = [
  { name: 'Inline', value: SplitViewDisplayMode.Inline },
  { name: 'CompactInline', value: SplitViewDisplayMode.CompactInline },
  { name: 'Overlay', value: SplitViewDisplayMode.Overlay },
  { name: 'CompactOverlay', value: SplitViewDisplayMode.CompactOverlay },
] as const

export function SplitViewPage(context: AppContext) {
  const paneOpen = signal(true)
  const displayModeIndex = signal(0)
  const paneOnRight = signal(false)
  const openPaneLength = signal(240)
  const compactPaneLength = signal(48)
  const paneBackgroundIndex = signal(0)
  const selectedPage = signal('Home')
  const paneToggle: RefObject<ToggleInstance> = { current: null }
  const placementToggle: RefObject<ToggleInstance> = { current: null }
  const openLengthInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const compactLengthInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const paneBrushes = [
    createSolidColorBrush(SolidColorBrush, color(243, 243, 243)),
    createSolidColorBrush(SolidColorBrush, color(230, 230, 230)),
    createSolidColorBrush(SolidColorBrush, color(220, 235, 252)),
  ] as const

  return (
    <Page
      title="SplitView"
      subtitle="A pane and content surface with inline, compact, or overlay behavior."
      automationId="SplitViewPageHeading"
      pageId="split-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutSplitViewSample"
        title="A basic SplitView"
        description="Configure pane visibility, placement, display mode, lengths, and background."
        code={`
<GallerySplitView
  isPaneOpen={paneOpen}
  displayMode={displayMode}
  panePlacement={panePlacement}
  paneContent={<PaneContent />}
>
  <MainContent />
</GallerySplitView>
        `}
        output={
          <UI.TextBlock
            automationId="GallerySplitViewStatus"
            text={computed(() => `Selected: ${selectedPage.value}`)}
          />
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.ToggleSwitch
              ref={paneToggle}
              automationId="GallerySplitViewPaneOpen"
              header="IsPaneOpen"
              isOn
              onToggled={() => {
                const next =
                  paneToggle.current?.isOn ?? paneOpen.value
                if (next !== paneOpen.value) {
                  paneOpen.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.ToggleSwitch
              ref={placementToggle}
              automationId="GallerySplitViewPanePlacement"
              header="Pane on right"
              onToggled={() => {
                const next =
                  placementToggle.current?.isOn ??
                  paneOnRight.value
                if (next !== paneOnRight.value) {
                  paneOnRight.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GallerySplitViewDisplayMode"
              header={<UI.TextBlock text="DisplayMode" />}
              selectedIndex={displayModeIndex}
              onSelectedIndexChange={(index) => {
                if (index !== displayModeIndex.value) {
                  displayModeIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {displayModes.map((item) => (
                <UI.TextBlock key={item.name} text={item.name} />
              ))}
            </GalleryComboBox>
            <UI.NumberBox
              ref={openLengthInput}
              automationId="GallerySplitViewOpenPaneLength"
              header="OpenPaneLength"
              value={240}
              minimum={128}
              maximum={500}
              spinButtonPlacementMode={
                NumberBoxSpinButtonPlacementMode.Inline
              }
              onValueChanged={() => {
                const next = openLengthInput.current?.value
                if (
                  next !== undefined &&
                  Number.isFinite(next) &&
                  next !== openPaneLength.value
                ) {
                  openPaneLength.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.NumberBox
              ref={compactLengthInput}
              automationId="GallerySplitViewCompactPaneLength"
              header="CompactPaneLength"
              value={48}
              minimum={24}
              maximum={128}
              spinButtonPlacementMode={
                NumberBoxSpinButtonPlacementMode.Inline
              }
              onValueChanged={() => {
                const next = compactLengthInput.current?.value
                if (
                  next !== undefined &&
                  Number.isFinite(next) &&
                  next !== compactPaneLength.value
                ) {
                  compactPaneLength.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GallerySplitViewPaneBackground"
              header={<UI.TextBlock text="PaneBackground" />}
              selectedIndex={paneBackgroundIndex}
              onSelectedIndexChange={(index) => {
                if (index !== paneBackgroundIndex.value) {
                  paneBackgroundIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              <UI.TextBlock text="Light" />
              <UI.TextBlock text="Neutral" />
              <UI.TextBlock text="Accent" />
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <GallerySplitView
          automationId="GallerySplitViewControl"
          height={300}
          isPaneOpen={paneOpen}
          openPaneLength={openPaneLength}
          compactPaneLength={compactPaneLength}
          displayMode={computed(
            () =>
              displayModes[displayModeIndex.value]?.value ??
              SplitViewDisplayMode.Inline,
          )}
          panePlacement={computed(() =>
            paneOnRight.value
              ? SplitViewPanePlacement.Right
              : SplitViewPanePlacement.Left,
          )}
          paneBackground={computed(
            () =>
              paneBrushes[paneBackgroundIndex.value] ??
              paneBrushes[0],
          )}
          onPaneClosed={() => {
            paneOpen.value = false
          }}
          onPaneOpened={() => {
            paneOpen.value = true
          }}
          paneContent={
            <UI.StackPanel padding={thickness(12)} spacing={8}>
              <UI.TextBlock text="Navigation" />
              {['Home', 'Messages', 'Settings'].map((name) => (
                <UI.Button
                  key={name}
                  automationId={`GallerySplitView${name}`}
                  onClick={() => {
                    selectedPage.value = name
                    context.model.recordInteraction()
                  }}
                >
                  {name}
                </UI.Button>
              ))}
            </UI.StackPanel>
          }
        >
          <UI.StackPanel padding={thickness(24)} spacing={12}>
            <UI.TextBlock
              fontSize={24}
              text={selectedPage}
            />
            <UI.TextBlock
              text="The main content stays in a separately owned SplitView slot."
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        </GallerySplitView>
      </SampleCard>
    </Page>
  )
}
