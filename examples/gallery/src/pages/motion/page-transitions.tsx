import {
  onCleanup,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  CommonNavigationTransitionInfo,
  ContentControl,
  ContinuumNavigationTransitionInfo,
  DrillInNavigationTransitionInfo,
  EntranceNavigationTransitionInfo,
  Frame,
  Grid,
  HorizontalAlignment,
  NavigationThemeTransition,
  NavigationTransitionInfo,
  projectAs,
  releaseProjected,
  SlideNavigationTransitionEffect,
  SlideNavigationTransitionInfo,
  SuppressNavigationTransitionInfo,
  TextWrapping,
  TransitionCollection,
  UIElement,
  XamlReader,
} from '#winapp/bindings'
import {
  type AppContext,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  releaseMotionResources,
  useMotionSettings,
} from './shared'

const frameXaml = `
<Grid
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Frame x:Name="ContentFrame" MinHeight="600" />
</Grid>`

function pageXaml(pageNumber: number): string {
  const background =
    pageNumber % 2 === 0
      ? 'AccentFillColorDefaultBrush'
      : 'CardBackgroundFillColorSecondaryBrush'
  return `
<Grid
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  Padding="32"
  Background="{ThemeResource ${background}}">
  <StackPanel Spacing="16"
    HorizontalAlignment="Center"
    VerticalAlignment="Center">
    <TextBlock
      AutomationProperties.AutomationId="GalleryMotionPageTransitionSurface${pageNumber + 1}"
      Text="Sample page ${pageNumber + 1}"
      FontSize="28"
      HorizontalAlignment="Center" />
    <TextBlock
      Text="Compare the selected native NavigationTransitionInfo."
      TextWrapping="Wrap"
      HorizontalAlignment="Center" />
  </StackPanel>
</Grid>`
}

export function PageTransitionsPage(context: AppContext) {
  const motion = useMotionSettings()
  let mountedHost: ContentControl | null = null
  const selectedMode = signal(0)
  const pageResult = signal('Showing sample page 1')
  const transitionNames = [
    'Default',
    'Entrance',
    'DrillIn',
    'Suppress',
    'Slide from Right',
    'Slide from Left',
    'Common',
    'Continuum',
  ] as const
  const root = projectAs(XamlReader.load(frameXaml), Grid)
  const frame = projectAs(
    root.findName('ContentFrame'),
    Frame,
  )
  const defaultTransition =
    new NavigationThemeTransition()
  const configuredTransition =
    new NavigationThemeTransition()
  const defaultTransitions = new TransitionCollection()
  defaultTransitions.append(defaultTransition)
  const configuredTransitions = new TransitionCollection()
  configuredTransitions.append(configuredTransition)
  const entrance = new EntranceNavigationTransitionInfo()
  const drillIn = new DrillInNavigationTransitionInfo()
  const suppress = new SuppressNavigationTransitionInfo()
  const slideRight = new SlideNavigationTransitionInfo()
  slideRight.effect = SlideNavigationTransitionEffect.FromRight
  const slideLeft = new SlideNavigationTransitionInfo()
  slideLeft.effect = SlideNavigationTransitionEffect.FromLeft
  const common = new CommonNavigationTransitionInfo()
  const continuum = new ContinuumNavigationTransitionInfo()
  const transitions: readonly (NavigationTransitionInfo | null)[] = [
    null,
    entrance,
    drillIn,
    suppress,
    slideRight,
    slideLeft,
    common,
    continuum,
  ]
  const createPage = (pageNumber: number) => {
    return projectAs(
      XamlReader.load(pageXaml(pageNumber)),
      UIElement,
    )
  }
  const pages = [createPage(0), createPage(1)] as const
  const history = [0]
  let historyIndex = 0
  const applyTransition = () => {
    const selected = motion.enabled.value
      ? transitions[selectedMode.value] ?? null
      : suppress
    if (selected) {
      configuredTransition.defaultNavigationTransitionInfo =
        selected
      frame.contentTransitions = configuredTransitions
    }
    else {
      frame.contentTransitions = defaultTransitions
    }
  }
  const showPage = (page: UIElement) => {
    applyTransition()
    frame.content = page
  }
  const navigateForward = (recordInteraction = true) => {
    const currentPage = history[historyIndex] ?? 0
    const pageNumber = (currentPage + 1) % pages.length
    history.splice(historyIndex + 1)
    history.push(pageNumber)
    historyIndex += 1
    showPage(pages[pageNumber]!)
    pageResult.value = `Showing sample page ${pageNumber + 1}`
    if (recordInteraction) {
      context.model.recordInteraction()
    }
  }
  const navigateBackward = () => {
    if (historyIndex <= 0) {
      return
    }
    historyIndex -= 1
    const pageNumber = history[historyIndex] ?? 0
    showPage(pages[pageNumber]!)
    pageResult.value =
      `Showing sample page ${pageNumber + 1}`
    context.model.recordInteraction()
  }
  onCleanup(() => {
    let firstError: unknown
    const attempt = (action: () => void) => {
      try {
        action()
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    attempt(() => {
      if (mountedHost) {
        mountedHost.content = null
      }
      frame.content = null
    })
    attempt(() => {
      for (const page of pages) {
        releaseProjected(page)
      }
    })
    attempt(() =>
      releaseMotionResources([
        configuredTransitions,
        defaultTransitions,
        configuredTransition,
        defaultTransition,
        entrance,
        drillIn,
        suppress,
        slideRight,
        slideLeft,
        common,
        continuum,
      ]),
    )
    attempt(() => releaseProjected(frame))
    attempt(() => releaseProjected(root))
    mountedHost = null
    if (firstError !== undefined) {
      throw firstError
    }
  })

  return (
    <Page
      title="Page Transitions"
      subtitle="Page transitions provide visual feedback about the relationship between pages."
      automationId="PageTransitionsPageHeading"
      pageId="page-transitions"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionPageTransitionsStatus"
        settings={motion}
      />
      <UI.TextBlock
        automationId="GalleryMotionPageTransitionsResult"
        text={pageResult}
      />
      <SampleCard
        title="Page transitions"
        description="Select a transition mode, then move forward or backward between native XAML page surfaces hosted by a XamlReader-created Frame."
        code={`const frame = projectAs(
  XamlReader.load(frameXaml).findName('ContentFrame'),
  Frame,
)
const transition = new SlideNavigationTransitionInfo()
transition.effect = SlideNavigationTransitionEffect.FromRight
const themeTransition = new NavigationThemeTransition()
themeTransition.defaultNavigationTransitionInfo = transition
frame.contentTransitions = transitionCollection(themeTransition)
frame.content = nextNativePageSurface`}
        options={
          <UI.StackPanel spacing={12}>
            <UI.TextBlock text="Transition modes" />
            <UI.StackPanel spacing={4}>
              {transitionNames.map((name, index) => (
                <UI.RadioButton
                  key={name}
                  automationName={`${name} NavigationTransitionInfo`}
                  groupName="MotionPageTransitionMode"
                  content={name}
                  isChecked={selectedMode.value === index}
                  onChecked={() => {
                    selectedMode.value = index
                  }}
                />
              ))}
            </UI.StackPanel>
            <UI.TextBlock text="Navigate" />
            <UI.Button
              automationId="GalleryMotionPageTransitionsForward"
              horizontalAlignment={HorizontalAlignment.Stretch}
              onClick={() => navigateForward()}
            >
              Navigate Forward
            </UI.Button>
            <UI.Button
              automationId="GalleryMotionPageTransitionsBackward"
              horizontalAlignment={HorizontalAlignment.Stretch}
              onClick={navigateBackward}
            >
              Navigate Backward
            </UI.Button>
            <UI.TextBlock
              text="Native ceiling: the current dynwinrt TypeName projection cannot safely call Frame.navigate(), so this sample hosts XamlReader-created page surfaces in a native Frame and applies the same NavigationTransitionInfo variants through NavigationThemeTransition."
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        }
      >
        <UI.ContentControl
          ref={(value) => {
            if (value) {
              mountedHost = value
            }
          }}
          content={root}
          horizontalContentAlignment={HorizontalAlignment.Stretch}
          onLoaded={() => {
            showPage(pages[0])
          }}
        />
      </SampleCard>
    </Page>
  )
}
