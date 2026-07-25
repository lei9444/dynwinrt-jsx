import {
  createNavigationItem,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AnimatedBackVisualSource,
  AnimatedChevronDownSmallVisualSource,
  AnimatedChevronRightDownSmallVisualSource,
  AnimatedChevronUpDownSmallVisualSource,
  AnimatedFindVisualSource,
  AnimatedGlobalNavigationButtonVisualSource,
  AnimatedIcon,
  AnimatedSettingsVisualSource,
  NavigationViewItem,
  Symbol,
  SymbolIcon,
  SymbolIconSource,
  TextBlock,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  Navigation,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AnimatedIconPage(context: AppContext) {
  const icon: RefObject<AnimatedIcon> = { current: null }
  const sources = [
    ['AnimatedBackVisualSource', new AnimatedBackVisualSource()],
    ['AnimatedChevronDownSmallVisualSource', new AnimatedChevronDownSmallVisualSource()],
    ['AnimatedChevronRightDownSmallVisualSource', new AnimatedChevronRightDownSmallVisualSource()],
    ['AnimatedChevronUpDownSmallVisualSource', new AnimatedChevronUpDownSmallVisualSource()],
    ['AnimatedFindVisualSource', new AnimatedFindVisualSource()],
    ['AnimatedGlobalNavigationButtonVisualSource', new AnimatedGlobalNavigationButtonVisualSource()],
    ['AnimatedSettingsVisualSource', new AnimatedSettingsVisualSource()],
  ] as const
  const sourceIndex = signal(4)
  const source = signal(sources[4]![1])
  const status = signal('AnimatedIcon state: Normal')
  const fallback = new SymbolIconSource()
  fallback.symbol = Symbol.Find
  const setState = (state: string) => {
    const current = icon.current
    if (!current) {
      throw new Error('AnimatedIcon is not mounted.')
    }
    AnimatedIcon.setState(current, state)
    status.value =
      `AnimatedIcon state: ${AnimatedIcon.getState(current)}`
  }
  const settingsSource = new AnimatedSettingsVisualSource()
  const settingsFallback = new SymbolIconSource()
  settingsFallback.symbol = Symbol.Setting
  const settingsIcon = new AnimatedIcon()
  settingsIcon.source = settingsSource
  settingsIcon.fallbackIconSource = settingsFallback
  const itemBindings = {
    NavigationViewItem,
    SymbolIcon,
    TextBlock,
  }
  const settingsItem = createNavigationItem(itemBindings, {
    label: 'Game Settings',
    icon: settingsIcon,
    name: 'game-settings',
  })

  return (
    <Page
      title="AnimatedIcon"
      subtitle="An element that displays and controls an icon that animates when the user interacts with the control."
      automationId="AnimatedIconPageHeading"
      pageId="animated-icon"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesAnimatedIconSample"
        title="AnimatedIcon in a button"
        description="Choose one of the built-in visual sources. Pointer enter and exit drive PointerOver and Normal states."
        code={`
<UI.AnimatedIcon
  source={source}
  fallbackIconSource={fallback}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesAnimatedIconStatus"
            text={status}
          />
        }
        options={
          <UI.StackPanel spacing={8}>
            <GalleryComboBox
              header="Kind"
              selectedIndex={sourceIndex}
              onSelectedIndexChange={(index) => {
                sourceIndex.value = index
                source.value = sources[index]?.[1] ?? sources[4]![1]
                context.model.recordInteraction()
              }}
              minWidth={340}
            >
              {sources.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.Button
              automationId="GalleryStylesAnimatedIconToggle"
              onClick={() => {
                setState(
                  status.peek().endsWith('Normal')
                    ? 'PointerOver'
                    : 'Normal',
                )
                context.model.recordInteraction()
              }}
            >
              Toggle animation state
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Button
          width={75}
          automationName="AnimatedIcon example"
          onPointerEntered={() => setState('PointerOver')}
          onPointerExited={() => setState('Normal')}
        >
          <UI.AnimatedIcon
            ref={icon}
            automationId="GalleryStylesAnimatedIconControl"
            width={64}
            height={64}
            source={source}
            fallbackIconSource={fallback}
          />
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesAnimatedIconNavigationSample"
        title="AnimatedIcon in NavigationView"
        description="NavigationViewItem drives the AnimatedIcon states automatically as its selection and pointer states change."
        code={`
const item = createNavigationItem(bindings, {
  content: 'Game Settings',
  icon: settingsIcon,
})
<Navigation menuItems={[item]} />
        `}
      >
        <Navigation
          automationId="GalleryStylesAnimatedIconNavigation"
          height={180}
          isSettingsVisible={false}
          menuItems={[settingsItem]}
        />
      </SampleCard>
    </Page>
  )
}
