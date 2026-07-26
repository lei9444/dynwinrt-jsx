import {
  computed,
  onCleanup,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Clipboard,
  ClipboardContentOptions,
  DataPackage,
  Orientation,
  StandardDataFormats,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type TextBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

function formatNativeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ClipboardPage(context: AppContext) {
  const text = signal('This text will be copied to the clipboard.')
  const pastedText = signal('Nothing pasted yet.')
  const copyStatus = signal('Ready to use the system Clipboard.')
  const optionsStatus = signal('Clipboard options have not been applied.')
  const operationsStatus = signal('Clipboard formats have not been inspected.')
  const historyStatus = signal('Clipboard history capability has not been checked.')
  const textBox: RefObject<TextBoxInstance> = { current: null }
  const historyToggle: RefObject<ToggleInstance> = { current: null }
  const roamingToggle: RefObject<ToggleInstance> = { current: null }
  const monitorToggle: RefObject<ToggleInstance> = { current: null }
  let contentChangedToken:
    | ReturnType<typeof Clipboard.add_ContentChanged>
    | undefined

  const refreshHistoryStatus = () => {
    try {
      historyStatus.value =
        `Clipboard history: ${Clipboard.isHistoryEnabled() ? 'enabled' : 'disabled'}; ` +
        `roaming: ${Clipboard.isRoamingEnabled() ? 'enabled' : 'disabled'}.`
    }
    catch (error) {
      historyStatus.value =
        `Clipboard history status is unavailable: ${formatNativeError(error)}`
    }
  }

  const describeFormats = () => {
    try {
      const formats = Clipboard.getContent().availableFormats.toArray()
      operationsStatus.value = formats.length > 0
        ? `Available formats: ${formats.join(', ')}`
        : 'The system Clipboard is empty.'
    }
    catch (error) {
      operationsStatus.value =
        `Could not inspect the Clipboard: ${formatNativeError(error)}`
    }
  }

  const stopMonitoring = () => {
    if (contentChangedToken !== undefined) {
      Clipboard.remove_ContentChanged(contentChangedToken)
      contentChangedToken = undefined
    }
  }

  onCleanup(() => {
    stopMonitoring()
  })

  return (
    <Page
      title="Clipboard"
      subtitle="Copy and paste text, configure history and roaming, monitor changes, and inspect system Clipboard formats."
      automationId="ClipboardPageHeading"
      pageId="clipboard"
      model={context.model}
      onLoaded={refreshHistoryStatus}
    >
      <SampleCard
        automationId="GallerySystemClipboardTextSample"
        title="Copy and paste text"
        description="Writes and reads operate on the real Windows Clipboard through the projected asynchronous text API."
        code={`const data = new DataPackage()
data.setText(text)
Clipboard.setContent(data)
Clipboard.flush()

const pasted = await Clipboard.getContent().getTextAsync()`}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GallerySystemClipboardCopyStatus"
              text={copyStatus}
              textWrapping={TextWrapping.Wrap}
            />
            <UI.TextBlock
              automationId="GallerySystemClipboardPastedText"
              text={computed(() => `Clipboard text: ${pastedText.value}`)}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBox
            ref={textBox}
            automationId="GallerySystemClipboardInput"
            automationName="Text to copy"
            text={text}
            onTextChanged={() => {
              const next = textBox.current?.text
              if (next !== undefined) {
                text.value = next
              }
            }}
          />
          <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
            <UI.Button
              automationId="GallerySystemClipboardCopy"
              onClick={() => {
                try {
                  const currentText =
                    textBox.current?.text ?? text.value
                  text.value = currentText
                  const data = new DataPackage()
                  data.setText(currentText)
                  Clipboard.setContent(data)
                  Clipboard.flush()
                  copyStatus.value =
                    'Text durably copied to the system Clipboard.'
                  context.model.recordInteraction()
                }
                catch (error) {
                  copyStatus.value =
                    `Copy failed: ${formatNativeError(error)}`
                }
              }}
            >
              Copy text
            </UI.Button>
            <UI.Button
              automationId="GallerySystemClipboardPaste"
              onClick={async () => {
                try {
                  const content = Clipboard.getContent()
                  if (!content.contains(StandardDataFormats.text)) {
                    pastedText.value = 'Text format is not available.'
                    return
                  }
                  copyStatus.value = 'Reading text from the system Clipboard...'
                  pastedText.value = await content.getTextAsync()
                  copyStatus.value = 'Text pasted from the system Clipboard.'
                  context.model.recordInteraction()
                }
                catch (error) {
                  copyStatus.value =
                    `Paste failed: ${formatNativeError(error)}`
                }
              }}
            >
              Paste text
            </UI.Button>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GallerySystemClipboardOptionsSample"
        title="Clipboard history and roaming options"
        description="SetContentWithOptions reports whether Windows accepted the requested history and roaming policy."
        code={`const options = new ClipboardContentOptions()
options.isAllowedInHistory = allowHistory
options.isRoamable = allowRoaming
const accepted = Clipboard.setContentWithOptions(data, options)
if (accepted) Clipboard.flush()`}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GallerySystemClipboardOptionsStatus"
              text={optionsStatus}
              textWrapping={TextWrapping.Wrap}
            />
            <UI.TextBlock
              automationId="GallerySystemClipboardHistoryStatus"
              text={historyStatus}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.ToggleSwitch
            ref={historyToggle}
            header="Allow in Clipboard history"
            isOn
          />
          <UI.ToggleSwitch
            ref={roamingToggle}
            header="Allow Clipboard roaming"
            isOn
          />
          <UI.Button
            automationId="GallerySystemClipboardCopyOptions"
            onClick={() => {
              try {
                const data = new DataPackage()
                data.setText(textBox.current?.text ?? text.value)
                const options = new ClipboardContentOptions()
                options.isAllowedInHistory =
                  historyToggle.current?.isOn ?? true
                options.isRoamable =
                  roamingToggle.current?.isOn ?? true
                const accepted = Clipboard.setContentWithOptions(
                  data,
                  options,
                )
                if (accepted) {
                  Clipboard.flush()
                  optionsStatus.value =
                    'Windows accepted and durably stored the Clipboard history and roaming options.'
                  context.model.recordInteraction()
                }
                else {
                  optionsStatus.value =
                    'Windows rejected the Clipboard history and roaming options.'
                }
                refreshHistoryStatus()
              }
              catch (error) {
                optionsStatus.value =
                  `Clipboard options copy failed: ${formatNativeError(error)}`
              }
            }}
          >
            Copy with options
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GallerySystemClipboardOperationsSample"
        title="Formats, clear, and ContentChanged"
        description="Inspect the formats Windows currently exposes, clear the Clipboard, or own a ContentChanged subscription until this page unmounts."
        code={`const content = Clipboard.getContent()
const formats = content.availableFormats.toArray()

const token = Clipboard.add_ContentChanged(onChanged)
Clipboard.remove_ContentChanged(token)`}
        output={
          <UI.TextBlock
            automationId="GallerySystemClipboardOperationsStatus"
            text={operationsStatus}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
            <UI.Button
              automationId="GallerySystemClipboardShowFormats"
              onClick={describeFormats}
            >
              Show formats
            </UI.Button>
            <UI.Button
              automationId="GallerySystemClipboardClear"
              onClick={() => {
                try {
                  Clipboard.clear()
                  operationsStatus.value =
                    'The system Clipboard has been cleared.'
                  context.model.recordInteraction()
                }
                catch (error) {
                  operationsStatus.value =
                    `Clear failed: ${formatNativeError(error)}`
                }
              }}
            >
              Clear Clipboard
            </UI.Button>
          </UI.StackPanel>
          <UI.ToggleSwitch
            ref={monitorToggle}
            automationId="GallerySystemClipboardMonitor"
            header="Monitor ContentChanged"
            onToggled={() => {
              stopMonitoring()
              if (monitorToggle.current?.isOn) {
                contentChangedToken = Clipboard.add_ContentChanged(() => {
                  operationsStatus.value =
                    'Clipboard content changed. Inspecting current formats...'
                  describeFormats()
                })
                operationsStatus.value =
                  'Monitoring system Clipboard changes.'
              }
              else {
                operationsStatus.value =
                  'Stopped monitoring system Clipboard changes.'
              }
            }}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
