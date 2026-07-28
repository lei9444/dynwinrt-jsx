import {
  computed,
  cornerRadius,
  createUri,
  gridLength,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  DatePicker,
  HorizontalAlignment,
  InfoBarSeverity,
  ListViewItem,
  ListViewSelectionMode,
  SelectorItem,
  TextWrapping,
  Uri,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryInfoBar,
  GalleryListView,
  LayoutGrid,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { formatDateTime } from '../date-time/shared'
import {
  BulletList,
  GuidanceSection,
  GuidanceText,
} from './shared'

const detailItems = [
  {
    title: 'Item 1',
    date: 'Jun 15, 2025 9:30 AM',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer id facilisis lectus. Cras nec convallis ante, quis pulvinar tellus.',
  },
  {
    title: 'Item 2',
    date: 'Jul 22, 2025 2:15 PM',
    text: 'Quisque accumsan pretium ligula in faucibus. Mauris sollicitudin augue vitae lorem cursus condimentum quis ac mauris.',
  },
  {
    title: 'Item 3',
    date: 'Aug 3, 2025 11:00 AM',
    text: 'Ut consequat magna luctus justo egestas vehicula. Integer pharetra risus libero, et posuere justo mattis et.',
  },
  {
    title: 'Item 4',
    date: 'Sep 10, 2025 4:45 PM',
    text: 'Duis facilisis, quam ut laoreet commodo, elit ex aliquet massa, non varius tellus lectus et nunc.',
  },
] as const

function DetailListItem(props: {
  readonly item: typeof detailItems[number]
  readonly index: number
  readonly onSelected: () => void
}) {
  let currentItem: ListViewItem | null = null
  let unsubscribeSelected:
    | (() => void)
    | undefined
  const setItemRef = (item: ListViewItem | null) => {
    if (currentItem === item) {
      return
    }
    if (unsubscribeSelected) {
      unsubscribeSelected()
      unsubscribeSelected = undefined
    }
    currentItem = item
    if (!item) {
      return
    }
    const property = SelectorItem.isSelectedProperty
    let token: bigint
    try {
      token = item.registerPropertyChangedCallback(
        property,
        () => {
          if (item.isSelected) {
            props.onSelected()
          }
        },
      )
    }
    catch (error) {
      currentItem = null
      throw error
    }
    unsubscribeSelected = () => {
      item.unregisterPropertyChangedCallback(property, token)
    }
  }
  return (
    <UI.ListViewItem
      ref={setItemRef}
      automationId={`GalleryBindingDetailItem${props.index}`}
    >
      <UI.StackPanel padding={thickness(4)} spacing={2}>
        <UI.TextBlock
          fontWeight={{ weight: 600 }}
          text={props.item.title}
        />
        <UI.TextBlock
          foreground={theme.secondaryText}
          text={props.item.date}
        />
      </UI.StackPanel>
    </UI.ListViewItem>
  )
}

export function BindingPage(context: AppContext) {
  const oneWayText = signal('')
  const twoWayText = signal('')
  const converterText = signal('')
  const selectedDateText = signal('No date selected.')
  const selectedDetailIndex = signal(0)
  const oneWaySource: RefObject<TextBoxInstance> = { current: null }
  const twoWaySource: RefObject<TextBoxInstance> = { current: null }
  const twoWayTarget: RefObject<TextBoxInstance> = { current: null }
  const converterInput: RefObject<TextBoxInstance> = { current: null }
  const datePicker: RefObject<DatePicker> = { current: null }
  const selectedDetail = computed(
    () => detailItems[selectedDetailIndex.value] ?? detailItems[0],
  )
  const updateTwoWay = (source: RefObject<TextBoxInstance>) => {
    const value = source.current?.text ?? ''
    if (value !== twoWayText.value) {
      twoWayText.value = value
      context.model.recordInteraction()
    }
  }

  return (
    <Page
      title="Binding"
      subtitle="Connecting UI elements to data for automatic synchronization and updates."
      automationId="BindingPageHeading"
      pageId="binding"
      model={context.model}
    >
      <GuidanceSection>
        <GuidanceText text="A binding connects a target property on a control to a source such as another control, application state, or a view model." />
        <BulletList
          items={[
            'OneWay updates the target when the source changes.',
            'TwoWay updates both the target and the source.',
            'OneTime sets the target once and does not update it afterward.',
          ]}
        />
        <GuidanceText text="In dynwinrt-jsx, signals and typed binding helpers provide the same synchronization goals without compiled x:Bind markup." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryBindingSample"
        title="Compare OneWay and TwoWay binding"
        description="The left pair mirrors source changes only. The right pair shares one signal, so editing either TextBox updates the other."
        code={`
const oneWayText = signal('')
const twoWayText = signal('')

<UI.TextBox text={oneWayText} />
<UI.TextBox text={twoWayText} onTextChanged={updateSource} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryBindingStatus"
            text={computed(() =>
              `TwoWay value: ${twoWayText.value || '(empty)'}`,
            )}
          />
        }
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
          columnSpacing={16}
        >
          <UI.StackPanel spacing={8}>
            <UI.TextBlock
              fontWeight={{ weight: 600 }}
              text="OneWay binding"
            />
            <UI.TextBox
              ref={oneWaySource}
              automationId="GalleryBindingOneWaySource"
              minWidth={320}
              placeholderText="Enter text here"
              onTextChanged={() => {
                oneWayText.value =
                  oneWaySource.current?.text ?? ''
                context.model.recordInteraction()
              }}
            />
            <UI.TextBox
              automationId="GalleryBindingOneWayTarget"
              minWidth={320}
              placeholderText="Mirrors above text"
              text={oneWayText}
            />
          </UI.StackPanel>

          <UI.StackPanel gridColumn={1} spacing={8}>
            <UI.TextBlock
              fontWeight={{ weight: 600 }}
              text="TwoWay binding"
            />
            <UI.TextBox
              ref={twoWaySource}
              automationId="GalleryBindingInput"
              minWidth={320}
              placeholderText="Enter text here"
              text={twoWayText}
              onTextChanged={() => updateTwoWay(twoWaySource)}
            />
            <UI.TextBox
              ref={twoWayTarget}
              automationId="GalleryBindingTwoWayMirror"
              minWidth={320}
              placeholderText="Mirrors and edits above text"
              text={twoWayText}
              onTextChanged={() => updateTwoWay(twoWayTarget)}
            />
          </UI.StackPanel>
        </LayoutGrid>
      </SampleCard>

      <SampleCard
        automationId="GalleryBindingPropertySample"
        title="Bind to a property declared in code"
        description="A component property or signal can provide a strongly typed source for one or more native properties."
        code={`
const greetingMessage = 'Hello, WinUI 3!'
<UI.TextBlock text={greetingMessage} />
        `}
      >
        <UI.TextBlock
          horizontalAlignment={HorizontalAlignment.Center}
          fontSize={24}
          text="Hello, WinUI 3!"
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryBindingFunctionSample"
        title="Bind through a formatting function"
        description="The DatePicker event reads the projected nullable DateTime and formats it into the target TextBlock."
        code={`
<UI.DatePicker
  onSelectedDateChanged={() => {
    output.value = formatDateTime(picker.current?.selectedDate ?? null)
  }}
/>
<UI.TextBlock text={output} />
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.DatePicker
            ref={datePicker}
            automationId="GalleryBindingDatePicker"
            header="Select a date"
            onSelectedDateChanged={() => {
              selectedDateText.value = formatDateTime(
                datePicker.current?.selectedDate ?? null,
              )
              context.model.recordInteraction()
            }}
          />
          <UI.TextBlock
            automationId="GalleryBindingDateOutput"
            text={computed(
              () => `Selected date is: ${selectedDateText.value}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryBindingConverterSample"
        title="Convert a source value for the target"
        description="A computed signal is the TSX equivalent of a small IValueConverter: it maps the current string to a native Visibility value."
        code={`
const visibility = computed(() =>
  input.value.trim() ? Visibility.Visible : Visibility.Collapsed)
<UI.TextBlock visibility={visibility} />
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBox
            ref={converterInput}
            automationId="GalleryBindingConverterInput"
            width={300}
            header="Enter Text:"
            onTextChanged={() => {
              converterText.value =
                converterInput.current?.text ?? ''
              context.model.recordInteraction()
            }}
          />
          <UI.TextBlock
            automationId="GalleryBindingConverterOutput"
            text="The input is not empty."
            visibility={computed(() =>
              converterText.value.trim()
                ? Visibility.Visible
                : Visibility.Collapsed,
            )}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryBindingViewModelSample"
        title="Bind to a view model"
        description="Application state remains separate from the visual tree and can drive several target properties."
        code={`
const viewModel = {
  title: 'Welcome to WinUI 3',
  description: 'This is an example of binding to a view model.',
}
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBlock
            fontWeight={{ weight: 600 }}
            text="Title:"
          />
          <UI.TextBlock
            fontSize={16}
            text="Welcome to WinUI 3"
          />
          <UI.TextBlock
            fontWeight={{ weight: 600 }}
            text="Description:"
          />
          <UI.TextBlock
            fontSize={16}
            text="This is an example of binding to a view model."
          />
        </UI.StackPanel>
      </SampleCard>

      <GalleryInfoBar
        automationId="GalleryBindingMvvmInfo"
        title="MVVM Toolkit"
        isClosable={false}
        isOpen
        message="The MVVM Toolkit, part of the .NET Community Toolkit, simplifies Model-View-ViewModel applications and provides a separate sample app."
        severity={InfoBarSeverity.Informational}
        action={
          <UI.HyperlinkButton
            navigateUri={createUri(
              Uri,
              'https://github.com/CommunityToolkit/MVVM-Samples',
            )}
          >
            Go to the MVVM Toolkit repository
          </UI.HyperlinkButton>
        }
      />

      <SampleCard
        automationId="GalleryBindingTargetNullSample"
        title="Provide a target value for null"
        description="A fallback keeps the target meaningful when the source has no value."
        code={`
const displayName = sourceName ?? 'Anonymous User'
<UI.TextBlock text={displayName} />
        `}
      >
        <UI.TextBlock text="Anonymous User" />
      </SampleCard>

      <SampleCard
        automationId="GalleryBindingCollectionSample"
        title="Bind collection data to an item template and detail view"
        description="The ListView item component is the TSX DataTemplate equivalent, and selectedIndex drives the detail pane."
        code={`
<GalleryListView selectedIndex={selectedIndex}>
  {items.map((item) => <ListDetailItem {...item} />)}
</GalleryListView>
<DetailPane item={selectedItem} />
        `}
      >
        <LayoutGrid
          minHeight={250}
          columnDefinitions={[
            gridLength.pixel(220),
            gridLength.star(),
          ]}
          columnSpacing={16}
        >
          <GalleryListView
            automationId="GalleryBindingDetailList"
            height={250}
            borderBrush={theme.cardStroke}
            borderThickness={thickness(1)}
            cornerRadius={cornerRadius(4)}
            selectedIndex={selectedDetailIndex}
            selectionMode={ListViewSelectionMode.Single}
          >
            {detailItems.map((item, index) => (
              <DetailListItem
                key={item.title}
                item={item}
                index={index}
                onSelected={() => {
                  if (index !== selectedDetailIndex.value) {
                    selectedDetailIndex.value = index
                    context.model.recordInteraction()
                  }
                }}
              />
            ))}
          </GalleryListView>

          <UI.StackPanel
            gridColumn={1}
            padding={thickness(16)}
            spacing={8}
          >
            <UI.TextBlock
              automationId="GalleryBindingDetailTitle"
              fontSize={20}
              fontWeight={{ weight: 600 }}
              text={computed(() => selectedDetail.value.title)}
            />
            <UI.TextBlock
              foreground={theme.secondaryText}
              text={computed(() => selectedDetail.value.date)}
            />
            <UI.TextBlock
              text={computed(() => selectedDetail.value.text)}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
