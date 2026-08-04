import type { Renderer } from '../renderer/renderer'
import type { Child } from '../core/vnode'

export interface ContentDialogLike<Root, Result> {
  xamlRoot: Root
  showAsync(): Promise<Result>
}

export interface ContentDialogOptions<Result> {
  onClosed?: (result: Result) => void
  restoreFocus?: (result: Result) => void
}

export interface ShowContentDialogOptions<Root, Result>
extends ContentDialogOptions<Result> {
  readonly renderer: Renderer
  readonly dialog: ContentDialogLike<Root, Result> & object
  readonly xamlRoot: Root
  readonly content: Child
}

export function showContentDialog<Root, Result>(
  options: ShowContentDialogOptions<Root, Result>,
): Promise<Result>
export function showContentDialog<Root, Result>(
  renderer: Renderer,
  dialog: ContentDialogLike<Root, Result> & object,
  xamlRoot: Root,
  content: Child,
  options?: ContentDialogOptions<Result>,
): Promise<Result>
export async function showContentDialog<Root, Result>(
  rendererOrOptions:
    | Renderer
    | ShowContentDialogOptions<Root, Result>,
  dialogArgument?:
    | (ContentDialogLike<Root, Result> & object),
  xamlRootArgument?: Root,
  contentArgument?: Child,
  optionsArgument: ContentDialogOptions<Result> = {},
): Promise<Result> {
  const objectOptions =
    typeof rendererOrOptions === 'object' &&
    rendererOrOptions !== null &&
    'renderer' in rendererOrOptions &&
    'dialog' in rendererOrOptions
      ? rendererOrOptions
      : undefined
  const renderer = objectOptions?.renderer ??
    rendererOrOptions as Renderer
  const dialog = objectOptions?.dialog ?? dialogArgument
  const xamlRoot = objectOptions?.xamlRoot ??
    xamlRootArgument as Root
  const content = objectOptions?.content ?? contentArgument
  const options = objectOptions ?? optionsArgument
  if (!dialog) {
    throw new TypeError(
      'showContentDialog() requires a dialog.',
    )
  }
  dialog.xamlRoot = xamlRoot
  const handle = renderer.render(content, dialog)
  let disposed = false
  let closeSubscription: (() => void) | undefined
  let closedResult: Result | undefined
  const disposeContent = (result?: Result) => {
    if (disposed) {
      return
    }
    disposed = true
    closedResult = result
    closeSubscription?.()
    closeSubscription = undefined
    handle.dispose()
    if (closedResult !== undefined) {
      options.onClosed?.(closedResult)
      options.restoreFocus?.(closedResult)
    }
  }
  closeSubscription = (
    dialog as unknown as {
      onClosed?: (
        callback: (
          sender: unknown,
          args: { readonly result: Result },
        ) => void,
      ) => () => void
    }
  ).onClosed?.((_sender, args) => {
    disposeContent(args.result)
  })
  try {
    const result = await dialog.showAsync()
    disposeContent(result)
    return result
  } finally {
    disposeContent()
  }
}
