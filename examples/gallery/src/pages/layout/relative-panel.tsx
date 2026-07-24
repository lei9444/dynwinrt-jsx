import {
  Show,
  computed,
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type BorderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RelativePanelPage(context: AppContext) {
  const firstRef: RefObject<BorderInstance> = { current: null }
  const thirdRef: RefObject<BorderInstance> = { current: null }
  const firstTarget = signal<BorderInstance | null>(null)
  const thirdTarget = signal<BorderInstance | null>(null)

  return (
    <Page
      title="RelativePanel"
      subtitle="Sibling and panel-edge constraints without explicit coordinates."
      automationId="RelativePanelPageHeading"
      pageId="relative-panel"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutRelativePanelSample"
        title="Position children relative to each other"
        description="Use sibling references together with panel-edge and center alignment constraints."
        code={`
<UI.RelativePanel>
  <UI.Border ref={first} relativePanelAlignLeftWithPanel relativePanelAlignTopWithPanel />
  <UI.Border relativePanelRightOf={first.current} />
  <UI.Border ref={third} relativePanelAlignRightWithPanel relativePanelAlignTopWithPanel />
  <UI.Border
    relativePanelBelow={third.current}
    relativePanelAlignHorizontalCenterWith={third.current}
  />
</UI.RelativePanel>
        `}
      >
        <UI.RelativePanel
          automationId="GalleryRelativePanelControl"
          width={360}
          height={180}
        >
          <UI.Border
            ref={firstRef}
            {...styles.status({ tone: 'critical' })}
            width={72}
            height={72}
            relativePanelAlignLeftWithPanel
            relativePanelAlignTopWithPanel
            onLoaded={() => {
              if (firstRef.current) {
                firstTarget.value = firstRef.current
              }
            }}
          >
            <UI.TextBlock text="One" />
          </UI.Border>
          <Show when={computed(() => firstTarget.value !== null)}>
            {() => (
              <UI.Border
                {...styles.status({ tone: 'attention' })}
                width={72}
                height={72}
                relativePanelRightOf={firstTarget.value!}
              >
                <UI.TextBlock text="Two" />
              </UI.Border>
            )}
          </Show>
          <UI.Border
            ref={thirdRef}
            {...styles.status({ tone: 'success' })}
            width={72}
            height={72}
            relativePanelAlignRightWithPanel
            relativePanelAlignTopWithPanel
            onLoaded={() => {
              if (thirdRef.current) {
                thirdTarget.value = thirdRef.current
              }
            }}
          >
            <UI.TextBlock text="Three" />
          </UI.Border>
          <Show when={computed(() => thirdTarget.value !== null)}>
            {() => (
              <UI.Border
                {...styles.status({ tone: 'caution' })}
                width={72}
                height={72}
                relativePanelBelow={thirdTarget.value!}
                relativePanelAlignHorizontalCenterWith={
                  thirdTarget.value!
                }
              >
                <UI.TextBlock text="Four" />
              </UI.Border>
            )}
          </Show>
        </UI.RelativePanel>
      </SampleCard>
    </Page>
  )
}
