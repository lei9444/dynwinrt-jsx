import type { Renderer } from './renderer'
import type { Child } from './vnode'

export interface ContentDialogLike<Root, Result> {
  xamlRoot: Root
  showAsync(): Promise<Result>
}

export async function showContentDialog<Root, Result>(
  renderer: Renderer,
  dialog: ContentDialogLike<Root, Result> & object,
  xamlRoot: Root,
  content: Child,
): Promise<Result> {
  dialog.xamlRoot = xamlRoot
  const handle = renderer.render(content, dialog)
  let disposed = false
  let closeSubscription: (() => void) | undefined
  const disposeContent = () => {
    if (disposed) {
      return
    }
    disposed = true
    closeSubscription?.()
    closeSubscription = undefined
    handle.dispose()
  }
  closeSubscription = (
    dialog as unknown as {
      onClosed?: (callback: () => void) => () => void
    }
  ).onClosed?.(disposeContent)
  try {
    return await dialog.showAsync()
  } finally {
    disposeContent()
  }
}
