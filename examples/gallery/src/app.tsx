import {
  ErrorBoundary,
  styles,
  thickness,
  tokens,
  type Child,
} from 'dynwinrt-jsx'
import { TextWrapping } from '#winapp/bindings'
import { type AppContext, UI } from './gallery-ui'
import { Shell } from './gallery-shell'

export type { AppContext } from './gallery-ui'

export function renderApp(context: AppContext): Child {
  return (
    <ErrorBoundary
      reset={context.model.hotVersion}
      fallback={(error, errorContext) => (
        <UI.StackPanel
          padding={thickness(tokens.spacing.xl)}
          spacing={12}
        >
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text="Gallery render failed"
          />
          <UI.TextBlock
            text={`${errorContext.phase}: ${String(error)}`}
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      )}
    >
      <Shell {...context} />
    </ErrorBoundary>
  )
}
