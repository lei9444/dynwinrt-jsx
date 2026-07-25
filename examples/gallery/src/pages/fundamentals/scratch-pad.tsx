import {
  createFontFamily,
  gridLength,
  onCleanup,
  showContentDialog,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  ContentDialog,
  ContentDialogButton,
  ContentDialogResult,
  ContentControl,
  FontFamily,
  HorizontalAlignment,
  releaseProjected,
  ScrollBarVisibility,
  ScrollMode,
  TextBlock,
  TextWrapping,
  UIElement,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page } from '../../components/gallery-components'
import { loadNativeContent } from './shared'

const defaultScratchXaml = `<StackPanel BorderThickness="1" BorderBrush="Green" CornerRadius="4" Padding="3">
  <!-- Note: {x:Bind} is not supported in Scratch Pad. -->
  <TextBlock>This is a sample TextBlock.</TextBlock>
  <Button Content="Click me!"/>
</StackPanel>`

function addXamlNamespaces(markup: string): string {
  const xaml = markup.trim()
  const tag = /^<([A-Za-z_][\w:.-]*)\b/.exec(xaml)
  if (!tag) {
    throw new TypeError('Scratch Pad markup must start with one root element.')
  }
  const openingTagEnd = xaml.indexOf('>')
  if (openingTagEnd < 0) {
    throw new TypeError('The root element start tag is incomplete.')
  }
  const openingTag = xaml.slice(0, openingTagEnd)
  const namespaces = [
    openingTag.includes('xmlns=')
      ? ''
      : ' xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
    openingTag.includes('xmlns:x=')
      ? ''
      : ' xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
  ].join('')
  return `${xaml.slice(0, tag[0].length)}${namespaces}${xaml.slice(tag[0].length)}`
}

export function ScratchPadPage(context: AppContext) {
  const editor: RefObject<TextBoxInstance> = { current: null }
  const previewHost: RefObject<ContentControl> = { current: null }
  const markup = signal(defaultScratchXaml)
  const status = signal('')
  const dialogOpen = signal(false)
  let loadedContent: UIElement | null = null
  const codeFont = createFontFamily(
    FontFamily,
    'Cascadia Code, Consolas',
  )
  const requireEditor = () => {
    const current = editor.current
    if (!current) {
      throw new Error('Scratch Pad editor is not mounted.')
    }
    return current
  }
  const requirePreviewHost = () => {
    const current = previewHost.current
    if (!current) {
      throw new Error('Scratch Pad preview host is not mounted.')
    }
    return current
  }
  const readMarkup = () => markup.value.trimEnd()
  const writeMarkup = (value: string) => {
    markup.value = value
  }
  const replacePreview = (
    content: unknown,
    ownedContent: UIElement | null,
  ) => {
    try {
      requirePreviewHost().content = content
    }
    catch (error: unknown) {
      if (ownedContent) {
        releaseProjected(ownedContent)
      }
      throw error
    }
    const previous = loadedContent
    loadedContent = ownedContent
    if (previous) {
      releaseProjected(previous)
    }
  }
  const loadMarkup = () => {
    try {
      const loaded = loadNativeContent(
        addXamlNamespaces(readMarkup()),
        true,
      )
      replacePreview(loaded, loaded)
      status.value = 'Load successful.'
      context.model.recordInteraction()
    }
    catch (error: unknown) {
      status.value = String(error)
    }
  }
  const resetToDefault = () => {
    writeMarkup(defaultScratchXaml)
    replacePreview(
      'Click the Load button to load the content below.',
      null,
    )
    status.value = ''
    context.model.recordInteraction()
  }
  const confirmReset = () => {
    if (dialogOpen.value) {
      return
    }
    dialogOpen.value = true
    const dialog = new ContentDialog()
    const title = new TextBlock()
    title.text = 'Are you sure you want to reset?'
    dialog.title = title
    dialog.primaryButtonText = 'Reset'
    dialog.closeButtonText = 'Cancel'
    dialog.defaultButton = ContentDialogButton.Primary
    void showContentDialog(
      context.renderer,
      dialog,
      context.window.content.xamlRoot,
      <UI.TextBlock
        text="Resetting to the default content will replace your current content."
        textWrapping={TextWrapping.Wrap}
      />,
      {
        onClosed: (result) => {
          dialogOpen.value = false
          if (result === ContentDialogResult.Primary) {
            resetToDefault()
          }
        },
      },
    ).catch((error: unknown) => {
      dialogOpen.value = false
      status.value = `Reset dialog failed: ${String(error)}`
    })
  }
  onCleanup(() => {
    let firstError: unknown
    try {
      if (previewHost.current) {
        previewHost.current.content = null
      }
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      if (loadedContent) {
        releaseProjected(loadedContent)
      }
      loadedContent = null
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })

  return (
    <Page
      title="Scratch Pad"
      subtitle="Scratch pad for testing simple XAML markup"
      automationId="ScratchPadPageHeading"
      pageId="scratch-pad"
      model={context.model}
    >
      <LayoutGrid
        automationId="GalleryScratchPadSample"
        height={720}
        rowDefinitions={[
          gridLength.star(),
          gridLength.star(),
        ]}
        borderBrush={theme.cardStroke}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.overlay}
      >
        <UI.ScrollViewer
          background={theme.solidBackground}
          horizontalScrollBarVisibility={ScrollBarVisibility.Visible}
          horizontalScrollMode={ScrollMode.Auto}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
          verticalScrollMode={ScrollMode.Auto}
        >
          <UI.ContentControl
            ref={previewHost}
            automationId="GalleryScratchPadPreview"
            content="Click the Load button to load the content below."
            horizontalContentAlignment={HorizontalAlignment.Center}
            verticalContentAlignment={VerticalAlignment.Center}
          />
        </UI.ScrollViewer>

        <LayoutGrid
          gridRow={1}
          padding={thickness(12)}
          rowDefinitions={[
            gridLength.star(),
            gridLength.auto(),
          ]}
          columnDefinitions={[
            gridLength.star(),
            { size: gridLength.auto(), min: 168 },
          ]}
          rowSpacing={8}
          columnSpacing={12}
          background={theme.ref('ExpanderContentBackground')}
          borderBrush={theme.dividerStroke}
          borderThickness={thickness(0, 1, 0, 0)}
        >
          <UI.TextBox
            ref={editor}
            automationId="GalleryScratchPadEditor"
            automationName="XAML markup textbox"
            acceptsReturn
            fontFamily={codeFont}
            fontSize={12}
            isSpellCheckEnabled={false}
            text={markup}
            textWrapping={TextWrapping.NoWrap}
            onTextChanged={() => {
              const next = requireEditor().text
              if (next !== markup.value) {
                markup.value = next
              }
              if (status.value === 'Load successful.') {
                status.value = ''
              }
            }}
          />
          <UI.StackPanel
            gridColumn={1}
            horizontalAlignment={HorizontalAlignment.Stretch}
            verticalAlignment={VerticalAlignment.Top}
            spacing={8}
          >
            <UI.Button
              automationId="GalleryScratchPadLoad"
              horizontalAlignment={HorizontalAlignment.Stretch}
              {...styles.button({ variant: 'accent' })}
              onClick={loadMarkup}
            >
              Load
            </UI.Button>
            <UI.Button
              automationId="GalleryScratchPadReset"
              horizontalAlignment={HorizontalAlignment.Stretch}
              toolTip="Resets to the default scratch pad content"
              onClick={confirmReset}
            >
              Reset
            </UI.Button>
          </UI.StackPanel>
          <UI.TextBlock
            automationId="GalleryScratchPadStatus"
            gridRow={1}
            gridColumnSpan={2}
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        </LayoutGrid>
      </LayoutGrid>
    </Page>
  )
}
