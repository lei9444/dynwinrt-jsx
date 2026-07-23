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
          <UI.StackPanel spacing={8}>
            <UI.Button
              automationId="GalleryRefreshDiagnostics"
              onClick={context.refreshDiagnostics}
            >
              Refresh diagnostics
            </UI.Button>
            <UI.Button
              automationId="GalleryInspectorExport"
              onClick={context.exportDiagnostics}
            >
              Export inspector snapshot
            </UI.Button>
          </UI.StackPanel>
        </UI.StackPanel>
      </Card>
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text="Worker heartbeat"
          />
          <UI.TextBlock
            automationId="GalleryHeartbeatStatus"
            text={computed(() =>
              `Heartbeat: ${context.model.heartbeatStatus.value}; sequence ${context.model.heartbeatSequence.value}`,
            )}
          />
          <UI.TextBlock
            text={computed(() => {
              const sent =
                context.model.heartbeatSentAt.value ??
                'not sent'
              const acknowledged =
                context.model.heartbeatAcknowledgedAt.value ??
                'not acknowledged'
              const timedOut =
                context.model.heartbeatTimeoutAt.value
              return timedOut
                ? `Last sent ${sent}; last acknowledged ${acknowledged}; timeout ${timedOut}`
                : `Last sent ${sent}; last acknowledged ${acknowledged}`
            })}
            textWrapping={TextWrapping.Wrap}
          />
          <UI.TextBlock
            automationId="GalleryInspectorExportStatus"
            text={context.model.inspectorExportStatus}
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </Card>
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text="Runtime inspector"
          />
          <UI.TextBlock
            automationId="GalleryInspectorSummary"
            text={computed(() => {
              const summary =
                context.model.inspectorSummary.value
              return [
                `${summary.nodes} nodes`,
                `${summary.scopes} scopes`,
                `${summary.observers} observers`,
                `${summary.dependencies} dependencies`,
                `${summary.subscriptions} subscriptions`,
                `${summary.cleanupFailures} cleanup failures`,
              ].join(' · ')
            })}
            textWrapping={TextWrapping.Wrap}
          />
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text="Recent operations"
          />
          <UI.TextBlock
            automationId="GalleryInspectorOperations"
            text={computed(() => {
              const operations =
                context.model.inspectorSummary.value.operations
              return operations.length > 0
                ? operations.join('\n')
                : 'No operations recorded.'
            })}
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </Card>
    </Page>
  )
}
