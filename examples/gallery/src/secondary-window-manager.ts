import {
  createSecondaryWindowManager,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  AppWindow,
  MicaBackdrop,
  Window,
} from '#winapp/bindings'

export function createGallerySecondaryWindowManager(
  renderer: Renderer,
) {
  return createSecondaryWindowManager<Window, AppWindow>({
    renderer,
    createWindow() {
      const window = new Window()
      window.systemBackdrop = new MicaBackdrop()
      return window
    },
  })
}

export type GallerySecondaryWindowManager =
  ReturnType<typeof createGallerySecondaryWindowManager>
