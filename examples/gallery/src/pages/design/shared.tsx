import {
  computed,
  gridLength,
  styles,
  theme,
  thickness,
  type Child,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ScrollBarVisibility,
  ScrollMode,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import { LayoutGrid, UI } from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'

export function DesignThemeImage(props: {
  readonly lightPath: string
  readonly darkPath: string
  readonly isDark: ReadonlySignal<boolean>
  readonly automationName: string
  readonly width?: number
  readonly height?: number
}) {
  const light = loadGalleryBitmap(props.lightPath, 1000)
  const dark = loadGalleryBitmap(props.darkPath, 1000)
  return (
    <UI.Image
      automationName={props.automationName}
      source={computed(() =>
        props.isDark.value ? dark : light,
      )}
      {...(props.width === undefined
        ? {}
        : { width: props.width })}
      {...(props.height === undefined
        ? {}
        : { height: props.height })}
    />
  )
}

export function DesignTableHeader(props: {
  readonly columns: readonly string[]
  readonly widths: readonly number[]
}) {
  return (
    <LayoutGrid
      columnDefinitions={props.widths.map((width) =>
        gridLength.pixel(width),
      )}
      columnSpacing={16}
      margin={thickness(16, 0, 16, 12)}
    >
      {props.columns.map((column, index) => (
        <UI.TextBlock
          key={column}
          gridColumn={index}
          foreground={theme.secondaryText}
          text={column}
        />
      ))}
    </LayoutGrid>
  )
}

export function DesignTableScroller(props: {
  readonly minWidth: number
  readonly children: Child
}) {
  return (
    <UI.ScrollViewer
      horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
      horizontalScrollMode={ScrollMode.Auto}
      verticalScrollBarVisibility={ScrollBarVisibility.Hidden}
    >
      <UI.StackPanel minWidth={props.minWidth} spacing={8}>
        {props.children}
      </UI.StackPanel>
    </UI.ScrollViewer>
  )
}

export function DesignTableRow(props: {
  readonly columns: readonly Child[]
  readonly widths: readonly number[]
  readonly alternate?: boolean
  readonly automationId?: string
}) {
  return (
    <UI.Border
      {...(props.automationId
        ? { automationId: props.automationId }
        : {})}
      {...styles.card({
        surface: props.alternate ? 'card' : 'layer',
      })}
      padding={thickness(16, 12)}
    >
      <LayoutGrid
        columnDefinitions={props.widths.map((width) =>
          gridLength.pixel(width),
        )}
        columnSpacing={16}
        horizontalAlignment={HorizontalAlignment.Stretch}
      >
        {props.columns.map((column, index) => (
          <UI.Border
            key={index}
            gridColumn={index}
            verticalAlignment={VerticalAlignment.Center}
          >
            {column}
          </UI.Border>
        ))}
      </LayoutGrid>
    </UI.Border>
  )
}

export function DesignDescription(props: {
  readonly text: string
}) {
  return (
    <UI.TextBlock
      text={props.text}
      textWrapping={TextWrapping.Wrap}
    />
  )
}
