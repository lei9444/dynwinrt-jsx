import {
  adapter,
  color,
  cornerRadius,
  createFocusTarget,
  createSolidColorBrush,
  gridLength,
  native,
  signal,
  styles,
  theme,
  thickness,
  type Child,
  type MaybeSignal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Button,
  FocusState,
  HorizontalAlignment,
  KeyboardAccelerator,
  Orientation,
  SolidColorBrush,
  TextWrapping,
  VirtualKey,
  VirtualKeyModifiers,
  XYFocusKeyboardNavigationMode,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryListView,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  GuidanceSection,
  GuidanceText,
} from '../fundamentals/shared'

const AcceleratorButton = native<
  Button,
  {
    accelerators?: MaybeSignal<Child>
  }
>(Button, {
  displayName: 'AcceleratorButton',
  adapters: {
    accelerators: adapter.collectionSlot('keyboardAccelerators'),
  },
})

const GalleryKeyboardAccelerator = native<
  KeyboardAccelerator,
  {
    acceleratorKey: MaybeSignal<VirtualKey>
  }
>(KeyboardAccelerator, {
  displayName: 'KeyboardAccelerator',
  adapters: {
    acceleratorKey: {
      kind: 'property',
      mode: 'oneWay',
      set: (instance, value) => {
        if (typeof value !== 'number') {
          throw new TypeError(
            'KeyboardAccelerator acceleratorKey must be a VirtualKey.',
          )
        }
        instance.key = value as VirtualKey
      },
    },
  },
})

export function KeyboardNavigationPage(context: AppContext) {
  const target = createFocusTarget<Button>(
    FocusState.Programmatic,
  )
  const status = signal('Focus follows a predictable tab order.')
  const shortcutStatus = signal('Choose a color or use its Ctrl shortcut.')
  const redAccelerator: RefObject<KeyboardAccelerator> = {
    current: null,
  }
  const red = createSolidColorBrush(
    SolidColorBrush,
    color(196, 43, 28),
  )
  const blue = createSolidColorBrush(
    SolidColorBrush,
    color(0, 120, 212),
  )
  const chartreuse = createSolidColorBrush(
    SolidColorBrush,
    color(127, 255, 0),
  )
  const shortcutBrush = signal(red)
  const chooseShortcutColor = (
    label: string,
    brush: SolidColorBrush,
  ) => {
    shortcutBrush.value = brush
    shortcutStatus.value = `${label} selected.`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Keyboard Navigation"
      subtitle="Keyboard-friendly design enables seamless interactions."
      automationId="KeyboardNavigationPageHeading"
      pageId="keyboard-navigation"
      model={context.model}
    >
      <GuidanceText text="If an app does not provide good keyboard access, users who are blind or have mobility limitations may have difficulty using it or may not be able to use it at all." />

      <GuidanceSection title="Tab order">
        <GuidanceText text="Interactive controls should normally be tab stops, non-interactive labels should not, and initial focus should start on the most useful logical element." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityKeyboardSample"
        title="Automatic tab order"
        description="By default, tab order follows the TSX child order. Labels and disabled controls are omitted from keyboard focus."
        code={`
<UI.Button>First</UI.Button>
<UI.TextBlock text="(not present)" />
<UI.Button>Second</UI.Button>
<UI.Button isEnabled={false}>(not present)</UI.Button>
<UI.Button>Third</UI.Button>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAccessibilityKeyboardStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={4}>
          <UI.Button
            automationId="GalleryAccessibilityKeyboardFirst"
            onGotFocus={() => {
              status.value = 'First button received focus.'
            }}
          >
            First
          </UI.Button>
          <UI.TextBlock text="(not present in tab order)" />
          <UI.Button
            ref={target}
            automationId="GalleryAccessibilityKeyboardTarget"
            onGotFocus={() => {
              status.value = 'Second button received focus.'
            }}
          >
            Second
          </UI.Button>
          <UI.Button isEnabled={false}>
            (not present in tab order)
          </UI.Button>
          <UI.Button
            automationId="GalleryAccessibilityKeyboardThird"
            onGotFocus={() => {
              status.value = 'Third button received focus.'
            }}
          >
            Third
          </UI.Button>
          <UI.Button
            automationId="GalleryAccessibilityKeyboardMoveFocus"
            onClick={() => {
              const accepted = target.focus()
              if (!accepted) {
                status.value = 'Focus request was rejected.'
              }
              context.model.recordInteraction()
            }}
          >
            Move focus to second
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryAccessibilityManualTabSample"
        title="Manual tab order"
        description="When visual order cannot match logical order, TabIndex and IsTabStop make the intended sequence explicit."
        code={`
<UI.Button tabIndex={1}>First stop</UI.Button>
<UI.Button tabIndex={3}>Third stop</UI.Button>
<UI.Button tabIndex={2}>Second stop</UI.Button>
<UI.Button isTabStop={false}>Not a stop</UI.Button>
        `}
      >
        <LayoutGrid
          rowDefinitions={[
            gridLength.auto(),
            gridLength.auto(),
            gridLength.auto(),
          ]}
          columnDefinitions={[
            gridLength.auto(),
            gridLength.auto(),
            gridLength.auto(),
          ]}
          rowSpacing={8}
          columnSpacing={8}
        >
          <UI.TextBlock
            gridColumn={1}
            horizontalAlignment={HorizontalAlignment.Center}
            text="Column 1"
          />
          <UI.TextBlock
            gridColumn={2}
            horizontalAlignment={HorizontalAlignment.Center}
            text="Column 2"
          />
          <UI.TextBlock
            gridRow={1}
            text="Row 1"
          />
          <UI.Button
            gridRow={1}
            gridColumn={1}
            tabIndex={1}
          >
            First stop
          </UI.Button>
          <UI.Button
            gridRow={1}
            gridColumn={2}
            tabIndex={3}
          >
            Third stop
          </UI.Button>
          <UI.TextBlock
            gridRow={2}
            text="Row 2"
          />
          <UI.Button
            gridRow={2}
            gridColumn={1}
            tabIndex={2}
          >
            Second stop
          </UI.Button>
          <UI.Button
            gridRow={2}
            gridColumn={2}
            isTabStop={false}
          >
            Not a stop
          </UI.Button>
        </LayoutGrid>
      </SampleCard>

      <GuidanceSection title="Arrow keys">
        <GuidanceText text="Groups of related controls usually support arrow keys and often Home, End, Page Up, and Page Down in addition to tab navigation." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityArrowListSample"
        title="Automatically supporting arrow keys"
        description="ListView handles arrow-key navigation, selection, Home/End, and accessibility set information natively."
        code={`
<GalleryListView automationName="Colors">
  <UI.ListViewItem>Red</UI.ListViewItem>
  <UI.ListViewItem>Blue</UI.ListViewItem>
</GalleryListView>
        `}
      >
        <UI.StackPanel spacing={4}>
          <GalleryListView
            automationId="GalleryAccessibilityKeyboardList"
            automationName="Colors"
            width={300}
          >
            {['Red', 'Blue', 'Green', 'Yellow'].map((item) => (
              <UI.ListViewItem key={item}>
                {item}
              </UI.ListViewItem>
            ))}
          </GalleryListView>
          <UI.TextBlock
            foreground={theme.secondaryText}
            text="Tab enters the control; arrow keys navigate within it."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryAccessibilityXYFocusSample"
        title="Manually supporting arrow keys with XYFocusKeyboardNavigation"
        description="XY focus enables directional navigation between independent buttons, but custom groups still need Home/End and set-position behavior when users expect a list."
        code={`
<UI.StackPanel
  orientation={Orientation.Horizontal}
  xYFocusKeyboardNavigation={XYFocusKeyboardNavigationMode.Enabled}
>
  <UI.Button>Boil 'em</UI.Button>
  <UI.Button>Mash 'em</UI.Button>
</UI.StackPanel>
        `}
      >
        <UI.Border
          {...styles.card({ surface: 'layer' })}
          padding={thickness(8)}
          automationName="Potatoes?"
        >
          <UI.StackPanel spacing={8}>
            <UI.TextBlock
              {...styles.heading({ level: 'bodyStrong' })}
              text="Potatoes?"
            />
            <UI.StackPanel
              orientation={Orientation.Horizontal}
              spacing={4}
              xYFocusKeyboardNavigation={
                XYFocusKeyboardNavigationMode.Enabled
              }
            >
              <UI.Button>Boil 'em</UI.Button>
              <UI.Button>Mash 'em</UI.Button>
              <UI.Button>Stick 'em in a stew</UI.Button>
            </UI.StackPanel>
          </UI.StackPanel>
        </UI.Border>
      </SampleCard>

      <GuidanceSection title="Keyboard shortcuts">
        <GuidanceText text="Accelerators invoke commands directly, while access keys move focus through discoverable Alt key tips." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityAcceleratorSample"
        title="Accelerators"
        description="Each button owns a native KeyboardAccelerator and exposes the same shortcut through UI Automation metadata."
        code={`
<AcceleratorButton
  automationAcceleratorKey="Ctrl+R"
  accelerators={
    <GalleryKeyboardAccelerator
      ref={redAccelerator}
      acceleratorKey={VirtualKey.R}
      modifiers={VirtualKeyModifiers.Control}
    />
  }
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAccessibilityAcceleratorStatus"
            text={shortcutStatus}
          />
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.Border
            height={30}
            background={shortcutBrush}
            cornerRadius={cornerRadius(4)}
          />
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
          >
            <AcceleratorButton
              automationId="GalleryAccessibilityAcceleratorRed"
              automationAcceleratorKey="Ctrl+R"
              accelerators={
                <GalleryKeyboardAccelerator
                  ref={redAccelerator}
                  acceleratorKey={VirtualKey.R}
                  modifiers={VirtualKeyModifiers.Control}
                />
              }
              onClick={() => {
                shortcutBrush.value = red
                const nativeKey = redAccelerator.current?.key
                shortcutStatus.value =
                  nativeKey === VirtualKey.R
                    ? 'Red selected; native accelerator: Ctrl+R.'
                    : `Red selected; native accelerator key: ${String(nativeKey)}.`
                context.model.recordInteraction()
              }}
            >
              Red
            </AcceleratorButton>
            <AcceleratorButton
              automationAcceleratorKey="Ctrl+B"
              accelerators={
                <GalleryKeyboardAccelerator
                  acceleratorKey={VirtualKey.B}
                  modifiers={VirtualKeyModifiers.Control}
                />
              }
              onClick={() => chooseShortcutColor('Blue', blue)}
            >
              Blue
            </AcceleratorButton>
            <AcceleratorButton
              automationAcceleratorKey="Ctrl+G"
              toolTip="A greenish-yellow (Ctrl+G)"
              accelerators={
                <GalleryKeyboardAccelerator
                  acceleratorKey={VirtualKey.G}
                  modifiers={VirtualKeyModifiers.Control}
                />
              }
              onClick={() =>
                chooseShortcutColor('Chartreuse', chartreuse)}
            >
              Chartreuse
            </AcceleratorButton>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryAccessibilityAccessKeySample"
        title="Access keys"
        description="Press and release Alt to display Key Tips; Alt plus the assigned letter moves focus into the menu hierarchy."
        code={`
<UI.MenuBar>
  <UI.MenuBarItem title="File" accessKey="F">
    <UI.MenuFlyoutItem text="New" accessKey="N" />
  </UI.MenuBarItem>
</UI.MenuBar>
        `}
      >
        <UI.MenuBar>
          <UI.MenuBarItem title="File" accessKey="F">
            <UI.MenuFlyoutItem text="New" accessKey="N" />
            <UI.MenuFlyoutItem text="Open..." accessKey="O" />
            <UI.MenuFlyoutItem text="Save" accessKey="S" />
            <UI.MenuFlyoutItem text="Exit" accessKey="E" />
          </UI.MenuBarItem>
          <UI.MenuBarItem title="Edit" accessKey="E">
            <UI.MenuFlyoutItem text="Undo" accessKey="U" />
            <UI.MenuFlyoutItem text="Cut" accessKey="X" />
            <UI.MenuFlyoutItem text="Copy" accessKey="C" />
            <UI.MenuFlyoutItem text="Paste" accessKey="V" />
          </UI.MenuBarItem>
          <UI.MenuBarItem title="Help" accessKey="H">
            <UI.MenuFlyoutItem text="About" accessKey="A" />
          </UI.MenuBarItem>
        </UI.MenuBar>
      </SampleCard>
    </Page>
  )
}
