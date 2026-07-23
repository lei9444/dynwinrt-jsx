import { Show, computed, formatRendererDiagnostics, styles } from 'dynwinrt-jsx'
import { TextWrapping } from '#winapp/bindings'
import { type AppContext, UI } from '../gallery-ui'
import { Card, Page } from '../components/gallery-components'

export function DiagnosticsPage(context: AppContext) {
  return (
    <Page
      title="Diagnostics"
      subtitle="Renderer counters, hot reload state, and persistence status."
      automationId="DiagnosticsPageHeading"
    >
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text="Runtime state"
          />
          <UI.TextBlock
            text={computed(() =>
              formatRendererDiagnostics(
                context.model.diagnostics.value,
              ),
            )}
          />
          <UI.TextBlock
            text={computed(
              () =>
                `Hot reload: ${context.model.hotStatus.value}; version ${context.model.hotVersion.value}`,
            )}
          />
          <UI.TextBlock
            text={computed(() =>
              context.model.persistenceError.value
                ? `Persistence recovery: ${context.model.persistenceError.value}`
                : context.model.updatedAt.value
                  ? `State changed ${context.model.updatedAt.value}`
                  : 'No persisted changes in this session.',
            )}
            textWrapping={TextWrapping.Wrap}
          />
          <Show when={context.model.lastError}>
            {(error) => (
              <UI.TextBlock
                automationId="GalleryHotReloadError"
                text={error}
                textWrapping={TextWrapping.Wrap}
              />
            )}
          </Show>
          <UI.Button onClick={context.refreshDiagnostics}>
            Refresh diagnostics
          </UI.Button>
        </UI.StackPanel>
      </Card>
    </Page>
  )
}
