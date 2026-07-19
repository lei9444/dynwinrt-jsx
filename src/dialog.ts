import type { Renderer } from './renderer'
import type { Child } from './vnode'

export interface ContentDialogLike<Root, Result> {
  xamlRoot: Root
  showAsync(): Promise<Result>
}

export interface ContentDialogOptions<Result> {
  onClosed?: (result: Result) => void
  restoreFocus?: (result: Result) => void
}

export async function showContentDialog<Root, Result>(
  renderer: Renderer,
  dialog: ContentDialogLike<Root, Result> & object,
  xamlRoot: Root,
  content: Child,
  options: ContentDialogOptions<Result> = {},
): Promise<Result> {
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
