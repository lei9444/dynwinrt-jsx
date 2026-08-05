import {
  computed,
  onCleanup,
  showPopup,
  signal,
  styles,
  thickness,
  type PopupController,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  NumberBoxSpinButtonPlacementMode,
  Popup,
} from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function PopupPage(context: AppContext) {
  const horizontalOffset = signal(200)
  const verticalOffset = signal(0)
  const lightDismiss = signal(true)
  const popupOpen = signal(false)
  const status = signal('Popup is closed.')
  const horizontalInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const verticalInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const lightDismissInput: RefObject<ToggleInstance> = {
    current: null,
  }
  let controller: PopupController<Popup> | null = null
  onCleanup(() => {
    controller?.dispose()
  })

  return (
    <Page
      title="Popup"
      subtitle="Temporary custom content positioned above the application UI."
      automationId="PopupPageHeading"
      pageId="popup"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDialogsPopupSample"
        title="Position a Popup with offsets"
        description="Adjust light-dismiss behavior and horizontal or vertical offsets before opening the popup."
        code={`
const popup = new Popup()
popup.horizontalOffset = horizontalOffset.value
popup.verticalOffset = verticalOffset.value
popup.isLightDismissEnabled = lightDismiss.value
const controller = showPopup(renderer, popup, <PopupContent />, {
  xamlRoot: window.content.xamlRoot,
})
        `}
        output={
          <UI.TextBlock
            automationId="GalleryPopupResult"
            text={status}
          />
        }
        options={
          <UI.StackPanel spacing={12}>
            <UI.ToggleSwitch
              ref={lightDismissInput}
              automationId="GalleryPopupLightDismiss"
              header="IsLightDismissEnabled"
              isOn
              isEnabled={computed(() => !popupOpen.value)}
              onContent="True"
              offContent="False"
              onToggled={() => {
                const next =
                  lightDismissInput.current?.isOn ??
                  lightDismiss.value
                if (next !== lightDismiss.value) {
                  lightDismiss.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.NumberBox
              ref={verticalInput}
              automationId="GalleryPopupVerticalOffset"
              header="VerticalOffset"
              value={0}
              minimum={-100}
              maximum={100}
              smallChange={10}
              largeChange={100}
              spinButtonPlacementMode={
                NumberBoxSpinButtonPlacementMode.Inline
              }
              onValueChanged={() => {
                const next = verticalInput.current?.value
                if (
                  next !== undefined &&
                  next !== verticalOffset.value
                ) {
                  verticalOffset.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.NumberBox
              ref={horizontalInput}
              automationId="GalleryPopupHorizontalOffset"
              header="HorizontalOffset"
              value={200}
              minimum={-100}
              maximum={500}
              smallChange={10}
              largeChange={100}
              spinButtonPlacementMode={
                NumberBoxSpinButtonPlacementMode.Inline
              }
              onValueChanged={() => {
                const next = horizontalInput.current?.value
                if (
                  next !== undefined &&
                  next !== horizontalOffset.value
                ) {
                  horizontalOffset.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryPopupShow"
          onClick={() => {
            controller?.dispose()
            const popup = new Popup()
            popup.horizontalOffset = horizontalOffset.value
            popup.verticalOffset = verticalOffset.value
            popup.isLightDismissEnabled = lightDismiss.value
            const nextController = showPopup(
              context.renderer,
              popup,
              <UI.Border
                {...styles.card({ surface: 'layer' })}
                padding={thickness(16)}
              >
                <UI.StackPanel spacing={8}>
                  <UI.TextBlock
                    fontSize={16}
                    text="Simple Popup"
                  />
                  <UI.Button
                    automationId="GalleryPopupClose"
                    onClick={() => {
                      controller?.close()
                    }}
                  >
                    Close
                  </UI.Button>
                </UI.StackPanel>
              </UI.Border>,
              {
                xamlRoot: context.window.content.xamlRoot,
                onClosed: () => {
                  popupOpen.value = false
                  status.value = 'Popup closed.'
                },
              },
            )
            controller = nextController
            popupOpen.value = true
            status.value = 'Popup is open.'
            context.model.recordInteraction()
          }}
        >
          Show Popup (using Offset)
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
