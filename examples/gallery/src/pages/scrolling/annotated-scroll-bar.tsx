import {
  color,
  computed,
  createSolidColorBrush,
  gridLength,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AnnotatedScrollBar,
  AnnotatedScrollBarLabel,
  PropertyValue,
  ScrollingContentOrientation,
  ScrollingScrollBarVisibility,
  ScrollView,
  SolidColorBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryAnnotatedScrollBar,
  LayoutGrid,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const sections = [
  { name: 'Azure', color: color(0, 127, 255) },
  { name: 'Crimson', color: color(220, 20, 60) },
  { name: 'Cyan', color: color(0, 183, 195) },
  { name: 'Fuchsia', color: color(180, 0, 158) },
  { name: 'Gold', color: color(255, 185, 0) },
] as const

export function AnnotatedScrollBarPage(context: AppContext) {
  const scrollView: RefObject<ScrollView> = { current: null }
  const scrollBar: RefObject<AnnotatedScrollBar> = {
    current: null,
  }
  const heightSlider: RefObject<SliderInstance> = {
    current: null,
  }
  const maxHeight = signal(340)
  const scrollStatus = signal('Use the labeled rail to navigate.')
  const brushes = sections.map((section) =>
    createSolidColorBrush(SolidColorBrush, section.color),
  )
  const labels = sections.map(
    (section, index) =>
      new AnnotatedScrollBarLabel(
        PropertyValue.createString(section.name),
        index * 200,
      ),
  )
  const connect = () => {
    const view = scrollView.current
    const bar = scrollBar.current
    const presenter = view?.scrollPresenter
    if (presenter && bar) {
      presenter.verticalScrollController =
        bar.scrollController
    }
  }
  const requireView = () => {
    const current = scrollView.current
    if (!current) {
      throw new Error('Annotated ScrollView is not mounted.')
    }
    return current
  }
  const labelForOffset = (offset: number) => {
    const index = Math.max(
      0,
      Math.min(
        sections.length - 1,
        Math.floor(offset / 200),
      ),
    )
    return sections[index]?.name ?? sections[0].name
  }

  return (
    <Page
      title="AnnotatedScrollBar"
      subtitle="Adds labeled positions and detail tooltips to a vertical scroll rail."
      automationId="AnnotatedScrollBarPageHeading"
      pageId="annotated-scroll-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryAnnotatedScrollBarSample"
        title="A labeled ScrollView controller"
        description="The AnnotatedScrollBar supplies the ScrollPresenter vertical controller and owns label objects through a collection adapter."
        code={`
<UI.ScrollView ref={scrollView}>
  <LongColorContent />
</UI.ScrollView>
<GalleryAnnotatedScrollBar
  ref={scrollBar}
  labelItems={labels}
  onDetailLabelRequested={(_sender, args) => {
    args.content = PropertyValue.createString(labelForOffset(args.scrollOffset))
  }}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock text={scrollStatus} />
            <UI.TextBlock
              automationId="GalleryAnnotatedScrollBarHeightStatus"
              text={computed(
                () =>
                  `Maximum height: ${Math.round(maxHeight.value)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.Slider
              ref={heightSlider}
              automationId="GalleryAnnotatedScrollBarMaxHeight"
              header="AnnotatedScrollBar maximum height"
              minimum={180}
              maximum={420}
              value={340}
              onValueChanged={() => {
                const next = heightSlider.current?.value
                if (
                  next !== undefined &&
                  Number.isFinite(next) &&
                  next !== maxHeight.value
                ) {
                  maxHeight.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Button
              automationId="GalleryAnnotatedScrollBarGold"
              onClick={() => {
                requireView().scrollTo(0, 800)
                context.model.recordInteraction()
              }}
            >
              Go to Gold
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.auto(),
          ]}
          columnSpacing={8}
        >
          <UI.ScrollView
            ref={scrollView}
            automationId="GalleryAnnotatedScrollView"
            width={500}
            height={340}
            contentOrientation={
              ScrollingContentOrientation.Vertical
            }
            verticalScrollBarVisibility={
              ScrollingScrollBarVisibility.Hidden
            }
            onLoaded={connect}
            onViewChanged={(sender) => {
              scrollStatus.value =
                `Visible section: ${labelForOffset(sender.verticalOffset)}.`
            }}
          >
            <UI.StackPanel spacing={8}>
              {sections.map((section, index) => (
                <UI.Border
                  key={section.name}
                  height={192}
                  padding={thickness(20)}
                  background={brushes[index]!}
                  cornerRadius={{
                    topLeft: 8,
                    topRight: 8,
                    bottomRight: 8,
                    bottomLeft: 8,
                  }}
                >
                  <UI.TextBlock
                    fontSize={28}
                    text={section.name}
                  />
                </UI.Border>
              ))}
              <UI.Border height={160} />
            </UI.StackPanel>
          </UI.ScrollView>
          <GalleryAnnotatedScrollBar
            ref={scrollBar}
            gridColumn={1}
            automationId="GalleryAnnotatedScrollBarControl"
            maxHeight={maxHeight}
            labelItems={labels}
            onLoaded={connect}
            onScrolling={(_sender, args) => {
              scrollStatus.value =
                `Scrolling to ${labelForOffset(args.scrollOffset)}.`
              context.model.recordInteraction()
            }}
            onDetailLabelRequested={(_sender, args) => {
              args.content = PropertyValue.createString(
                labelForOffset(args.scrollOffset),
              )
            }}
          />
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
