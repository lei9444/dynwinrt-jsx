import {
  computed,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  FontStyle,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryParagraph,
  GalleryRichTextBlock,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RichTextBlockPage(context: AppContext) {
  const limited = signal(false)

  return (
    <Page
      title="RichTextBlock"
      subtitle="Displays paragraphs containing independently formatted inline text."
      automationId="RichTextBlockPageHeading"
      pageId="rich-text-block"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryRichTextBlockSample"
        title="Paragraphs and formatted runs"
        description="Explicit block and inline collection adapters own Paragraph and Run lifetimes."
        code={`
<GalleryRichTextBlock>
  <GalleryParagraph>
    <UI.Run text="Rich text supports " />
    <UI.Run text="formatted runs" fontStyle={FontStyle.Italic} />
  </GalleryParagraph>
</GalleryRichTextBlock>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryRichTextBlockStatus"
            text={computed(() =>
              limited.value
                ? 'Maximum lines: 2'
                : 'Maximum lines: automatic',
            )}
          />
        }
        options={
          <UI.Button
            automationId="GalleryRichTextBlockLines"
            onClick={() => {
              limited.value = !limited.value
              context.model.recordInteraction()
            }}
          >
            Toggle line limit
          </UI.Button>
        }
      >
        <GalleryRichTextBlock
          automationId="GalleryRichTextBlockControl"
          width={520}
          padding={thickness(20)}
          textWrapping={TextWrapping.Wrap}
          isTextSelectionEnabled
          maxLines={computed(() => limited.value ? 2 : 0)}
        >
          <GalleryParagraph fontSize={22}>
            <UI.Run text="RichTextBlock supports " />
            <UI.Run
              text="formatted text"
              fontStyle={FontStyle.Italic}
              fontWeight={{ weight: 700 }}
            />
            <UI.Run text=", selection, and multiple paragraphs." />
          </GalleryParagraph>
          <GalleryParagraph fontSize={18}>
            <UI.Run text="Each Paragraph owns an InlineCollection, while each Run remains a projected WinUI text element." />
          </GalleryParagraph>
        </GalleryRichTextBlock>
      </SampleCard>
    </Page>
  )
}
