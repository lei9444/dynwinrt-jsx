import {
  computed,
  createAsyncAction,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  FileOpenPicker,
  FileSavePicker,
  FolderPicker,
  Orientation,
  PickerLocationId,
  PickerViewMode,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

type PickerAbortSignal = NonNullable<
  Parameters<FileOpenPicker['pickSingleFileAsync']>[0]
>

declare const require: (id: string) => unknown

interface FileSystemPromises {
  writeFile(path: string, data: string, encoding: string): Promise<void>
}

function formatNativeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function StoragePickersPage(context: AppContext) {
  const capability = signal('Picker capability has not been checked.')
  const fileContent = signal('Hello from dynwinrt-jsx Gallery!')
  const contentBox: RefObject<TextBoxInstance> = { current: null }
  const pickerAction = createAsyncAction<
    (signal: PickerAbortSignal) => Promise<string>,
    string
  >(async (action, { signal }) => {
    const message = await action(signal)
    context.model.recordInteraction()
    return message
  })
  const result = computed(() => {
    switch (pickerAction.status.value) {
      case 'idle':
        return 'No picker result yet.'
      case 'pending':
        return 'Picker operation in progress...'
      case 'success':
        return pickerAction.value.value ??
          'Picker operation completed.'
      case 'error':
        return `Picker unavailable or failed: ${
          formatNativeError(pickerAction.error.value)
        }`
      case 'disposed':
        return 'Picker operation disposed.'
    }
  })
  const runPicker = (
    action: (signal: PickerAbortSignal) => Promise<string>,
  ) => {
    pickerAction.run(action)
  }

  const configureOpenPicker = () => {
    const picker = new FileOpenPicker(context.window.appWindow.id)
    picker.fileTypeFilter.append('*')
    picker.commitButtonText = 'Pick file'
    picker.suggestedStartLocation = PickerLocationId.DocumentsLibrary
    picker.viewMode = PickerViewMode.List
    return picker
  }

  const checkCapability = () => {
    try {
      const windowId = context.window.appWindow.id
      const open = new FileOpenPicker(windowId)
      const save = new FileSavePicker(windowId)
      const folder = new FolderPicker(windowId)
      open.fileTypeFilter.append('*')
      save.fileTypeChoices.insert('Text files', ['.txt'])
      folder.suggestedStartLocation = PickerLocationId.DocumentsLibrary
      capability.value =
        `Native storage pickers are available for the main window (WindowId ${windowId.value}).`
      context.model.recordInteraction()
    }
    catch (error) {
      capability.value =
        `Native storage pickers are unavailable: ${formatNativeError(error)}`
    }
  }

  return (
    <Page
      title="Storage pickers"
      subtitle="Select files and folders with the Windows App SDK pickers initialized from the main window's WindowId."
      automationId="StoragePickersPageHeading"
      pageId="storage-pickers"
      model={context.model}
    >
      <UI.InfoBar
        isOpen
        isClosable={false}
        title="Main-window initialization"
        message="Every picker is constructed with context.window.appWindow.id, the WindowId for the Gallery's main HWND. Cancellation is reported as cancellation, never as success."
      />
      <SampleCard
        automationId="GallerySystemStoragePickerCapabilitySample"
        title="Capability"
        description="Construct all three native picker types without opening a dialog, and report the real activation result."
        code={`const windowId = context.window.appWindow.id
new FileOpenPicker(windowId)
new FileSavePicker(windowId)
new FolderPicker(windowId)`}
        output={
          <UI.TextBlock
            automationId="GallerySystemStoragePickerCapabilityStatus"
            text={capability}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.Button
          automationId="GallerySystemStoragePickerCheck"
          onClick={checkCapability}
        >
          Check picker capability
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GallerySystemStoragePickerOpenSample"
        title="Open files"
        description="Pick one file or multiple files with a real FileOpenPicker."
        code={`const picker = new FileOpenPicker(context.window.appWindow.id)
picker.fileTypeFilter.append('*')
const file = await picker.pickSingleFileAsync(signal)`}
        output={
          <UI.TextBlock
            automationId="GallerySystemStoragePickerResult"
            text={result}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            automationId="GallerySystemStoragePickerSingle"
            isEnabled={computed(() => !pickerAction.pending.value)}
            onClick={() => runPicker(async (abortSignal) => {
              const file = await configureOpenPicker()
                .pickSingleFileAsync(abortSignal)
              return file?.path
                ? `Picked file: ${file.path}`
                : 'File selection canceled.'
            })}
          >
            Pick a single file
          </UI.Button>
          <UI.Button
            automationId="GallerySystemStoragePickerMultiple"
            isEnabled={computed(() => !pickerAction.pending.value)}
            onClick={() => runPicker(async (abortSignal) => {
              const files = await configureOpenPicker()
                .pickMultipleFilesAsync(abortSignal)
              const paths = files.toArray().map((file) => file.path)
              return paths.length > 0
                ? `Picked files: ${paths.join('; ')}`
                : 'File selection canceled.'
            })}
          >
            Pick multiple files
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GallerySystemStoragePickerSaveSample"
        title="Save a file"
        description="FileSavePicker chooses the path; Node writes the requested text only after a non-empty native result."
        code={`const picker = new FileSavePicker(context.window.appWindow.id)
picker.fileTypeChoices.insert('Text files', ['.txt'])
const file = await picker.pickSaveFileAsync(signal)
if (file?.path) await fs.writeFile(file.path, content, 'utf8')`}
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBox
            ref={contentBox}
            automationId="GallerySystemStoragePickerSaveContent"
            text={fileContent}
            onTextChanged={() => {
              const next = contentBox.current?.text
              if (next !== undefined) {
                fileContent.value = next
              }
            }}
          />
          <UI.Button
            automationId="GallerySystemStoragePickerSave"
            isEnabled={computed(() => !pickerAction.pending.value)}
            onClick={() => runPicker(async (abortSignal) => {
              const picker = new FileSavePicker(
                context.window.appWindow.id,
              )
              picker.fileTypeChoices.insert(
                'Text files',
                ['.txt'],
              )
              picker.defaultFileExtension = '.txt'
              picker.suggestedFileName = 'NewDocument'
              picker.commitButtonText = 'Save file'
              picker.suggestedStartLocation =
                PickerLocationId.DocumentsLibrary
              const file = await picker.pickSaveFileAsync(abortSignal)
              if (!file?.path) {
                return 'File save canceled.'
              }
              const fs = require('node:fs/promises') as FileSystemPromises
              await fs.writeFile(file.path, fileContent.value, 'utf8')
              return `File saved: ${file.path}`
            })}
          >
            Save a file
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GallerySystemStoragePickerFolderSample"
        title="Pick a folder"
        description="FolderPicker returns a path only when the user confirms a folder."
        code={`const picker = new FolderPicker(context.window.appWindow.id)
const folder = await picker.pickSingleFolderAsync(signal)`}
      >
        <UI.Button
          automationId="GallerySystemStoragePickerFolder"
          isEnabled={computed(() => !pickerAction.pending.value)}
          onClick={() => runPicker(async (abortSignal) => {
            const picker = new FolderPicker(
              context.window.appWindow.id,
            )
            picker.commitButtonText = 'Pick folder'
            picker.suggestedStartLocation =
              PickerLocationId.DocumentsLibrary
            picker.viewMode = PickerViewMode.List
            const folder = await picker.pickSingleFolderAsync(abortSignal)
            return folder?.path
              ? `Picked folder: ${folder.path}`
              : 'Folder selection canceled.'
          })}
        >
          Pick a folder
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
