import {
  Show,
  computed,
  createSymbolIcon,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ImageIconSource,
  Orientation,
  PropertyValue,
  Symbol,
  SymbolIcon,
  TextAlignment,
  TextWrapping,
  TitleBar,
  TitleBarHeightOption,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  type ButtonInstance,
  GalleryRadioButtons,
  GalleryTitleBar,
  LayoutGrid,
  type RadioButtonsInstance,
  type TextBoxInstance,
  type TitleBarInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'
import {
  createSecondaryWindowManager,
  formatNativeError,
} from './shared'

function createTitleBarIcon() {
  const icon = new ImageIconSource()
  icon.imageSource = loadGalleryBitmap('GalleryAppIcon.png', 20)
  return icon
}

export function TitleBarPage(context: AppContext) {
  const windows = createSecondaryWindowManager(context.renderer)
  const title = signal('WinUI Gallery')
  const subtitle = signal('Preview')
  const showBack = signal(false)
  const showPane = signal(false)
  const status = signal('No TitleBar sample window is open.')
  const titleBox: RefObject<TextBoxInstance> = { current: null }
  const subtitleBox: RefObject<TextBoxInstance> = { current: null }
  const backToggle: RefObject<ToggleInstance> = { current: null }
  const paneToggle: RefObject<ToggleInstance> = { current: null }

  const runNative = (label: string, action: () => void) => {
    try {
      action()
      status.value = `${label} opened.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value = `${label} is unavailable: ${formatNativeError(error)}`
    }
  }

  const openDragRegionsWindow = () => {
    windows.openXamlWindow({
      title: 'TitleBar drag regions sample',
      configure(window) {
        window.extendsContentIntoTitleBar = true
        window.appWindow.titleBar.preferredHeightOption =
          TitleBarHeightOption.Tall
        window.appWindow.resize({ width: 900, height: 650 })
        window.appWindow.setIcon('Assets/Tiles/GalleryIcon.ico')
      },
      content: (window) => {
        const titleBarRef: RefObject<TitleBarInstance> = {
          current: null,
        }
        const badgeRef: RefObject<ButtonInstance> = {
          current: null,
        }
        const radioButtonsRef: RefObject<RadioButtonsInstance> = {
          current: null,
        }
        const badgeMode = signal(0)
        const extraVisible = signal(false)
        const childStatus = signal('')
        let mountedTitleBar: TitleBarInstance | null = null
        let mountedBadge: ButtonInstance | null = null

        const applyBadgeMode = (index: number) => {
          const badge = mountedBadge ?? badgeRef.current
          if (!badge) {
            return
          }
          if (index === 0) {
            badge.clearValue(TitleBar.isDragRegionProperty)
          }
          else {
            TitleBar.setIsDragRegion(badge, index === 1)
          }
        }

        return (
          <LayoutGrid
            rowDefinitions={[
              gridLength.auto(),
              gridLength.star(),
            ]}
          >
            <GalleryTitleBar
              ref={titleBarRef}
              title="Drag regions"
              subtitle="Try dragging the window"
              iconSource={createTitleBarIcon()}
              autoRefreshDragRegions={false}
              resourceOverrides={{
                TitleBarContentHorizontalAlignment:
                  PropertyValue.createInt32(
                    HorizontalAlignment.Stretch,
                  ),
              }}
              onLoaded={() => {
                mountedTitleBar = titleBarRef.current
                if (mountedTitleBar) {
                  window.setTitleBar(mountedTitleBar)
                }
              }}
            >
              <LayoutGrid
                columnDefinitions={[
                  gridLength.star(),
                  gridLength.auto(),
                ]}
                columnSpacing={8}
                horizontalAlignment={HorizontalAlignment.Stretch}
              >
                <UI.AutoSuggestBox
                  maxWidth={580}
                  horizontalAlignment={HorizontalAlignment.Stretch}
                  verticalAlignment={VerticalAlignment.Center}
                  placeholderText="Search..."
                  queryIcon={createSymbolIcon(
                    SymbolIcon,
                    Symbol.Find,
                  )}
                />
                <UI.StackPanel
                  gridColumn={1}
                  orientation={Orientation.Horizontal}
                  spacing={8}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <Show when={extraVisible}>
                    <UI.Button
                      verticalAlignment={VerticalAlignment.Center}
                    >
                      Extra
                    </UI.Button>
                  </Show>
                  <UI.Button
                    ref={badgeRef}
                    automationId="GalleryWindowingDragRegionStatusBadge"
                    verticalAlignment={VerticalAlignment.Center}
                    onLoaded={() => {
                      mountedBadge = badgeRef.current
                      applyBadgeMode(badgeMode.value)
                    }}
                    onClick={() => {
                      childStatus.value = 'Status badge clicked'
                    }}
                  >
                    Status
                  </UI.Button>
                </UI.StackPanel>
              </LayoutGrid>
            </GalleryTitleBar>
            <UI.ScrollViewer
              gridRow={1}
              padding={thickness(32, 24)}
            >
              <UI.StackPanel
                maxWidth={640}
                spacing={16}
              >
                <UI.TextBlock
                  {...styles.heading({ level: 'subtitle' })}
                  text="Custom drag regions"
                />
                <UI.TextBlock
                  text="Try dragging the window from different parts of the title bar. Interactive controls are automatically excluded from the drag region by default."
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.TextBlock
                  {...styles.heading({ level: 'bodyStrong' })}
                  text="Status badge: TitleBar.IsDragRegion"
                />
                <GalleryRadioButtons
                  ref={radioButtonsRef}
                  automationId="GalleryWindowingDragRegionModes"
                  selectedIndex={badgeMode}
                  onSelectionChanged={() => {
                    const index =
                      radioButtonsRef.current?.selectedIndex
                    if (index !== undefined && index >= 0) {
                      badgeMode.value = index
                      applyBadgeMode(index)
                    }
                  }}
                >
                  <UI.RadioButton>
                    Unset (framework decides — clickable)
                  </UI.RadioButton>
                  <UI.RadioButton>
                    True (always draggable)
                  </UI.RadioButton>
                  <UI.RadioButton>
                    False (always clickable)
                  </UI.RadioButton>
                </GalleryRadioButtons>
                <UI.TextBlock
                  {...styles.heading({ level: 'bodyStrong' })}
                  text="Dynamic content"
                />
                <UI.TextBlock
                  foreground={theme.secondaryText}
                  text="When you add or remove elements in TitleBar.Content at runtime, call RecomputeDragRegions() to refresh."
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={8}
                >
                  <UI.Button
                    automationId="GalleryWindowingToggleExtraTitleBarButton"
                    onClick={() => {
                      extraVisible.value = !extraVisible.value
                      childStatus.value = extraVisible.value
                        ? 'Added a Button to TitleBar.Content.'
                        : 'Removed the Button from TitleBar.Content.'
                    }}
                  >
                    Toggle extra title bar button
                  </UI.Button>
                  <UI.Button
                    automationId="GalleryWindowingRecomputeDragRegions"
                    onClick={() => {
                      mountedTitleBar?.recomputeDragRegions()
                      childStatus.value =
                        'RecomputeDragRegions() called.'
                    }}
                  >
                    RecomputeDragRegions()
                  </UI.Button>
                </UI.StackPanel>
                <UI.TextBlock
                  automationId="GalleryWindowingDragRegionsStatus"
                  foreground={theme.secondaryText}
                  text={childStatus}
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.Button
                  automationId="GalleryWindowingDragRegionsChildClose"
                  width={180}
                  onClick={() => window.close()}
                >
                  Close window
                </UI.Button>
              </UI.StackPanel>
            </UI.ScrollViewer>
          </LayoutGrid>
        )
      },
      onClosed() {
        status.value = 'TitleBar drag-regions sample closed.'
      },
    })
  }

  const openEndToEndWindow = () => {
    windows.openXamlWindow({
      title: 'TitleBar end-to-end sample',
      configure(window) {
        window.extendsContentIntoTitleBar = true
        window.appWindow.titleBar.preferredHeightOption =
          TitleBarHeightOption.Tall
        window.appWindow.resize({ width: 960, height: 680 })
        window.appWindow.setIcon('Assets/Tiles/GalleryIcon.ico')
      },
      content: (window) => {
        const titleBarRef: RefObject<TitleBarInstance> = {
          current: null,
        }
        const paneOpen = signal(true)
        const selectedPage = signal(1)
        let mountedTitleBar: TitleBarInstance | null = null
        return (
          <LayoutGrid
            rowDefinitions={[
              gridLength.auto(),
              gridLength.star(),
            ]}
          >
            <GalleryTitleBar
              ref={titleBarRef}
              title="WinUI Gallery"
              subtitle="TitleBar sample"
              iconSource={createTitleBarIcon()}
              isBackButtonVisible={computed(() =>
                selectedPage.value > 1,
              )}
              isPaneToggleButtonVisible
              rightHeaderContent={
                <UI.PersonPicture
                  width={30}
                  height={30}
                  initials="JD"
                />
              }
              resourceOverrides={{
                TitleBarContentHorizontalAlignment:
                  PropertyValue.createInt32(
                    HorizontalAlignment.Stretch,
                  ),
              }}
              onLoaded={() => {
                mountedTitleBar = titleBarRef.current
                if (mountedTitleBar) {
                  window.setTitleBar(mountedTitleBar)
                }
              }}
              onPaneToggleRequested={() => {
                paneOpen.value = !paneOpen.value
              }}
              onBackRequested={() => {
                selectedPage.value = Math.max(
                  1,
                  selectedPage.value - 1,
                )
              }}
            >
              <UI.AutoSuggestBox
                maxWidth={580}
                horizontalAlignment={HorizontalAlignment.Stretch}
                verticalAlignment={VerticalAlignment.Center}
                placeholderText="Search..."
              />
            </GalleryTitleBar>
            <LayoutGrid
              gridRow={1}
              columnDefinitions={[
                gridLength.auto(),
                gridLength.star(),
              ]}
            >
              <Show when={paneOpen}>
                <UI.StackPanel
                  width={220}
                  padding={thickness(12)}
                  spacing={8}
                  background={theme.cardBackground}
                >
                  {[1, 2, 3, 4].map((page) => (
                    <UI.Button
                      automationName={`Menu Item${page}`}
                      horizontalAlignment={HorizontalAlignment.Stretch}
                      onClick={() => {
                        selectedPage.value = page
                      }}
                    >
                      {`Menu Item${page}`}
                    </UI.Button>
                  ))}
                </UI.StackPanel>
              </Show>
              <UI.StackPanel
                gridColumn={1}
                spacing={16}
                padding={thickness(tokens.spacing.xl)}
                horizontalAlignment={HorizontalAlignment.Center}
                verticalAlignment={VerticalAlignment.Center}
              >
                <UI.TextBlock
                  {...styles.heading({ level: 'title' })}
                  text={computed(() =>
                    `Sample Page ${selectedPage.value}`,
                  )}
                  textAlignment={TextAlignment.Center}
                />
                <UI.TextBlock
                  text="The TitleBar pane and back requests update the navigation content in this native secondary Window."
                  textAlignment={TextAlignment.Center}
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.Button
                  automationId="GalleryWindowingEndToEndChildClose"
                  width={180}
                  onClick={() => window.close()}
                >
                  Close window
                </UI.Button>
              </UI.StackPanel>
            </LayoutGrid>
          </LayoutGrid>
        )
      },
      onClosed() {
        status.value = 'TitleBar end-to-end sample closed.'
      },
    })
  }

  return (
    <Page
      title="TitleBar"
      subtitle="An example showing how to use the default TitleBar control."
      automationId="TitleBarPageHeading"
      pageId="title-bar"
      model={context.model}
    >
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={4}
      >
        <UI.TextBlock text="For full title-bar customization without the TitleBar control, see the" />
        <UI.HyperlinkButton
          padding={thickness(0)}
          onClick={() => {
            context.model.navigate('app-window-title-bar')
          }}
        >
          AppWindowTitleBar sample
        </UI.HyperlinkButton>
      </UI.StackPanel>

      <SampleCard
        automationId="GalleryWindowingTitleBarConfigurationSample"
        title="TitleBar configuration"
        description="Configure the TitleBar title, subtitle, navigation affordances, icon, search content, and right header."
        code={`<GalleryTitleBar
  title={title}
  subtitle={subtitle}
  isBackButtonVisible={showBack}
  isPaneToggleButtonVisible={showPane}
  iconSource={icon}
  rightHeaderContent={<UI.PersonPicture initials="JD" />}
>
  <UI.AutoSuggestBox placeholderText="Search..." />
</GalleryTitleBar>`}
        options={
          <UI.StackPanel width={240} spacing={12}>
            <UI.TextBox
              ref={titleBox}
              header="Title"
              text={title}
              onTextChanged={() => {
                const next = titleBox.current?.text
                if (next !== undefined) {
                  title.value = next
                }
              }}
            />
            <UI.TextBox
              ref={subtitleBox}
              header="Subtitle"
              text={subtitle}
              onTextChanged={() => {
                const next = subtitleBox.current?.text
                if (next !== undefined) {
                  subtitle.value = next
                }
              }}
            />
            <UI.ToggleSwitch
              ref={backToggle}
              header="IsBackButtonVisible"
              isOn={showBack}
              onToggled={() => {
                const next = backToggle.current?.isOn
                if (next !== undefined) {
                  showBack.value = next
                }
              }}
            />
            <UI.ToggleSwitch
              ref={paneToggle}
              header="IsPaneToggleButtonVisible"
              isOn={showPane}
              onToggled={() => {
                const next = paneToggle.current?.isOn
                if (next !== undefined) {
                  showPane.value = next
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Border
          background={theme.cardBackground}
          borderBrush={theme.dividerStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          <GalleryTitleBar
            title={title}
            subtitle={subtitle}
            iconSource={createTitleBarIcon()}
            isBackButtonVisible={showBack}
            isPaneToggleButtonVisible={showPane}
            rightHeaderContent={
              <UI.PersonPicture
                width={30}
                height={30}
                initials="JD"
              />
            }
            resourceOverrides={{
              TitleBarContentHorizontalAlignment:
                PropertyValue.createInt32(
                  HorizontalAlignment.Stretch,
                ),
            }}
          >
            <UI.AutoSuggestBox
              maxWidth={580}
              horizontalAlignment={HorizontalAlignment.Stretch}
              verticalAlignment={VerticalAlignment.Center}
              placeholderText="Search..."
            />
          </GalleryTitleBar>
        </UI.Border>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingTitleBarDragRegionsSample"
        title="TitleBar drag regions"
        description="Drag regions can only be observed on a real window. Open a sample window to control TitleBar.IsDragRegion and call RecomputeDragRegions() after dynamic content changes."
        code={`TitleBar.setIsDragRegion(statusBadge, true)
titleBar.recomputeDragRegions()`}
        output={
          <UI.TextBlock
            automationId="GalleryWindowingTitleBarStatus"
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.Button
          automationId="GalleryWindowingTitleBarShowDragRegions"
          horizontalAlignment={HorizontalAlignment.Center}
          onClick={() => runNative(
            'TitleBar drag-regions sample',
            openDragRegionsWindow,
          )}
        >
          Show window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingTitleBarEndToEndSample"
        title="End-to-end TitleBar sample"
        description="Open a native Window where TitleBar pane and back requests drive navigation state and content."
        code={`window.extendsContentIntoTitleBar = true
window.setTitleBar(titleBar)
titleBar.onPaneToggleRequested(() => togglePane())
titleBar.onBackRequested(() => goBack())`}
      >
        <UI.Button
          automationId="GalleryWindowingTitleBarShowEndToEnd"
          horizontalAlignment={HorizontalAlignment.Center}
          onClick={() => runNative(
            'TitleBar end-to-end sample',
            openEndToEndWindow,
          )}
        >
          Show window
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
