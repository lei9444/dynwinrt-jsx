import {
  computed,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

function CounterControl(props: {
  readonly value: ReturnType<typeof signal<number>>
  readonly onIncrement: () => void
}) {
  return (
    <UI.Border padding={thickness(20)}>
      <UI.StackPanel spacing={10}>
        <UI.TextBlock
          automationId="GalleryCustomControlValue"
          fontSize={24}
          text={computed(() => `Custom value: ${props.value.value}`)}
        />
        <UI.Button
          automationId="GalleryCustomControlIncrement"
          onClick={props.onIncrement}
        >
          Increment custom control
        </UI.Button>
      </UI.StackPanel>
    </UI.Border>
  )
}

export function CustomUserControlsPage(context: AppContext) {
  const count = signal(0)

  return (
    <Page
      title="Custom & User Controls"
      subtitle="Encapsulates native layouts and behavior in reusable TSX components."
      automationId="CustomUserControlsPageHeading"
      pageId="custom-user-controls"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCustomControlsSample"
        title="A reusable counter control"
        description="Function components own their native subtree and reactive scope without a browser or React runtime."
        code={`
function CounterControl(props) {
  return <UI.StackPanel>...</UI.StackPanel>
}
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCustomControlStatus"
            text={computed(() => `Custom control count: ${count.value}`)}
          />
        }
      >
        <CounterControl
          value={count}
          onIncrement={() => {
            count.value += 1
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
