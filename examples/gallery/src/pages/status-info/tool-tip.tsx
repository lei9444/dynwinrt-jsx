import { thickness } from 'dynwinrt-jsx'
import {
  IReference_Rect,
  PlacementMode,
  PropertyValue,
  TextBlock,
  ToolTip,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'

function createToolTip(
  content: string,
  configure?: (toolTip: ToolTip) => void,
): ToolTip {
  const toolTip = new ToolTip()
  const text = new TextBlock()
  text.text = content
  toolTip.content = text
  configure?.(toolTip)
  return toolTip
}

export function ToolTipPage(context: AppContext) {
  const offsetToolTip = createToolTip(
    'Offset ToolTip.',
    (toolTip) => {
      toolTip.verticalOffset = -80
    },
  )
  const imageToolTip = createToolTip(
    'Non-occluding ToolTip.',
    (toolTip) => {
      toolTip.placementRect = IReference_Rect.from(
        PropertyValue.createRect({
        x: 0,
        y: 0,
        width: 400,
        height: 266,
        }),
      )
      toolTip.placement = PlacementMode.Right
    },
  )

  return (
    <Page
      title="ToolTip"
      subtitle="Contextual information shown when an element is hovered or focused."
      automationId="ToolTipPageHeading"
      pageId="tool-tip"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStatusToolTipSimpleSample"
        title="A simple ToolTip"
        description="Attach primitive tooltip content directly to a native control."
        code={`
<UI.Button toolTip="Simple ToolTip">
  Button with a simple ToolTip.
</UI.Button>
        `}
      >
        <UI.Button
          automationId="GalleryToolTipSimpleButton"
          toolTip="Simple ToolTip"
          onClick={() => {
            context.model.recordInteraction()
          }}
        >
          Button with a simple ToolTip.
        </UI.Button>
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusToolTipOffsetSample"
        title="A ToolTip with an offset"
        description="Attach a ToolTip control when offsets or other popup properties are needed."
        code={`
const toolTip = new ToolTip()
toolTip.content = content
toolTip.verticalOffset = -80
<UI.TextBlock toolTip={toolTip} text="TextBlock with an offset ToolTip." />
        `}
      >
        <UI.TextBlock
          automationId="GalleryToolTipOffsetText"
          toolTip={offsetToolTip}
          text="TextBlock with an offset ToolTip."
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusToolTipPlacementSample"
        title="A non-occluding image ToolTip"
        description="Use PlacementRect and right-side placement so the tooltip does not cover the image."
        code={`
toolTip.placementRect = IReference_Rect.from(
  PropertyValue.createRect({ x: 0, y: 0, width: 400, height: 266 }),
)
toolTip.placement = PlacementMode.Right
<UI.Image toolTip={toolTip} source={image} />
        `}
      >
        <UI.Image
          automationId="GalleryToolTipImage"
          automationHelpText="Non-occluding tooltip"
          toolTip={imageToolTip}
          width={400}
          height={266}
          margin={thickness(0)}
          source={loadGalleryBitmap(
            'SampleMedia/cliff.jpg',
            600,
          )}
        />
      </SampleCard>
    </Page>
  )
}
