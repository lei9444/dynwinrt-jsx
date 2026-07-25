import { onCleanup, signal } from 'dynwinrt-jsx'
import {
  DesktopAcrylicBackdrop,
  MicaBackdrop,
  MicaKind,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { markWindowBackdropRestored } from '../../backdrop-state'
import {
  BulletList,
  GuidanceText,
} from '../fundamentals/shared'

export function SystemBackdropsPage(context: AppContext) {
  const original = context.window.systemBackdrop
  const mica = new MicaBackdrop()
  const micaAlt = new MicaBackdrop()
  micaAlt.kind = MicaKind.BaseAlt
  const acrylic = new DesktopAcrylicBackdrop()
  const status = signal('Window backdrop: Mica')
  onCleanup(() => {
    context.window.systemBackdrop = original
    markWindowBackdropRestored()
  })

  const apply = (
    name: string,
    backdrop: MicaBackdrop | DesktopAcrylicBackdrop,
  ) => {
    context.window.systemBackdrop = backdrop
    status.value = `Window backdrop: ${name}`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="System Backdrops (Mica/Acrylic)"
      subtitle="System backdrops, like Mica and Acrylic, for app windows."
      automationId="SystemBackdropsPageHeading"
      pageId="system-backdrops"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesSystemBackdropsSample"
        title="Built-in backdrop types"
        description="Switch the current Gallery window between Mica Base, Mica Alt, and Desktop Acrylic. The original backdrop is restored when the page is disposed."
        code={`
window.systemBackdrop = new MicaBackdrop()
window.systemBackdrop = new DesktopAcrylicBackdrop()
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesSystemBackdropsStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.Button
            automationId="GalleryStylesSystemBackdropsMica"
            onClick={() => apply('Mica', mica)}
          >
            Use Mica Base
          </UI.Button>
          <UI.Button
            onClick={() => apply('Mica Alt', micaAlt)}
          >
            Use Mica Alt
          </UI.Button>
          <UI.Button
            automationId="GalleryStylesSystemBackdropsAcrylic"
            onClick={() => apply('Desktop Acrylic', acrylic)}
          >
            Use Desktop Acrylic
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesMicaControllerGuidance"
        title="MicaController guidance"
        description="Mica is opaque and samples the desktop wallpaper once, so it is the preferred performant material for main app windows."
        code={`const mica = new MicaBackdrop(); mica.kind = MicaKind.BaseAlt`}
      >
        <UI.StackPanel spacing={8}>
          <GuidanceText text="Mica Base is the default lighter appearance. Mica Alt has stronger tinting and is recommended for tabbed title bars." />
          <BulletList
            items={[
              'Custom controllers can tune fallback color, luminosity opacity, tint color, and tint opacity.',
              'Mica requires Windows 11 build 22000 or later.',
            ]}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesDesktopAcrylicGuidance"
        title="Desktop Acrylic controller guidance"
        description="Desktop Acrylic is semi-transparent and continuously blurs content behind the window."
        code={`window.systemBackdrop = new DesktopAcrylicBackdrop()`}
      >
        <UI.StackPanel spacing={8}>
          <GuidanceText text="Desktop Acrylic Base is darker with less transparency. The Thin variant is available only through DesktopAcrylicController, not DesktopAcrylicBackdrop." />
          <GuidanceText text="AcrylicBrush is a separate in-app brush for elements inside a window." />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
