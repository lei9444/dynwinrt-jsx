import { computed, signal } from 'dynwinrt-jsx'
import {
  ExpandDirection,
  HorizontalAlignment,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const directions = [
  { name: 'Down', value: ExpandDirection.Down },
  { name: 'Up', value: ExpandDirection.Up },
] as const

export function ExpanderPage(context: AppContext) {
  const directionIndex = signal(0)
  const direction = computed(
    () => directions[directionIndex.value]?.value ??
      ExpandDirection.Down,
  )

  return (
    <Page
      title="Expander"
      subtitle="A header that reveals or hides one content region."
      automationId="ExpanderPageHeading"
      pageId="expander"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutExpanderDirectionSample"
        title="Header, content, and expand direction"
        description="Expand downward or upward while preserving the same owned content."
        code={`
<UI.Expander
  header="This is the header"
  isExpanded
  expandDirection={direction}
>
  <UI.TextBlock text="This is the content" />
</UI.Expander>
        `}
        options={
          <GalleryComboBox
            automationId="GalleryExpanderDirection"
            header={<UI.TextBlock text="ExpandDirection" />}
            selectedIndex={directionIndex}
            onSelectedIndexChange={(index) => {
              if (index !== directionIndex.value) {
                directionIndex.value = index
                context.model.recordInteraction()
              }
            }}
            width={180}
          >
            {directions.map((item) => (
              <UI.TextBlock key={item.name} text={item.name} />
            ))}
          </GalleryComboBox>
        }
      >
        <UI.Expander
          automationId="GalleryExpanderDirectionControl"
          header="This is the header"
          isExpanded
          expandDirection={direction}
          verticalAlignment={computed(() =>
            direction.value === ExpandDirection.Up
              ? VerticalAlignment.Bottom
              : VerticalAlignment.Top,
          )}
        >
          <UI.TextBlock
            text="This is the content inside the Expander."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.Expander>
      </SampleCard>
      <SampleCard
        automationId="GalleryLayoutExpanderAlignmentSample"
        title="Modify content alignment"
        description="The content aligns to the left instead of stretching across the Expander."
        code={`
<UI.Expander
  header="Left aligned content"
  horizontalContentAlignment={HorizontalAlignment.Left}
>
  <UI.TextBlock text="Content" />
</UI.Expander>
        `}
      >
        <UI.Expander
          automationId="GalleryExpanderAlignmentControl"
          header="Left aligned content"
          isExpanded
          horizontalContentAlignment={HorizontalAlignment.Left}
        >
          <UI.TextBlock text="Content aligned to the left." />
        </UI.Expander>
      </SampleCard>
    </Page>
  )
}
