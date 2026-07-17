import {
  createRenderer,
  type NativeCollection,
  type NativePropertyConverter,
  type NativePropertySetter,
  type Renderer,
  type RendererOptions,
} from './renderer'

interface ProjectedCollection {
  as(interfaceType: unknown): NativeCollection
}

interface TextBlockInstance {
  text: string
}

interface TextBlockConstructor {
  new (): TextBlockInstance
}

interface PropertyValueType {
  createBoolean?(value: boolean): unknown
  createString(value: string): unknown
}

interface ReferenceBooleanType {
  from(value: unknown): unknown
}

interface ResourceMap {
  lookup(key: unknown): unknown
}

interface ResourceDictionary {
  as(interfaceType: unknown): ResourceMap
}

interface ApplicationType {
  readonly current: {
    readonly resources: ResourceDictionary
  } | null
}

export interface WinUIBindings {
  readonly IVector_UIElement?: unknown
  readonly TextBlock?: TextBlockConstructor
  readonly Grid?: object
  readonly Canvas?: object
  readonly AutomationProperties?: object
  readonly Application?: ApplicationType
  readonly IMap_Object_Object?: unknown
  readonly PropertyValue?: PropertyValueType
  readonly IReference_Boolean?: ReferenceBooleanType
}

function addStaticSetter(
  setters: Record<string, NativePropertySetter>,
  property: string,
  type: object | undefined,
  method: string,
): void {
  const setter = (type as Record<string, unknown> | undefined)?.[method]
  if (typeof setter !== 'function') {
    return
  }

  setters[property] = (target, value) => {
    ;(setter as (element: object, value: unknown) => void).call(
      type,
      target,
      value,
    )
  }
}

function createPropertySetters(
  bindings: WinUIBindings,
): Record<string, NativePropertySetter> {
  const setters: Record<string, NativePropertySetter> = {}

  addStaticSetter(setters, 'gridRow', bindings.Grid, 'setRow')
  addStaticSetter(setters, 'gridColumn', bindings.Grid, 'setColumn')
  addStaticSetter(setters, 'gridRowSpan', bindings.Grid, 'setRowSpan')
  addStaticSetter(setters, 'gridColumnSpan', bindings.Grid, 'setColumnSpan')
  addStaticSetter(setters, 'canvasLeft', bindings.Canvas, 'setLeft')
  addStaticSetter(setters, 'canvasTop', bindings.Canvas, 'setTop')
  addStaticSetter(
    setters,
    'automationId',
    bindings.AutomationProperties,
    'setAutomationId',
  )
  addStaticSetter(
    setters,
    'automationName',
    bindings.AutomationProperties,
    'setName',
  )

  return setters
}

export function createWinUIPropertyConverters(
  bindings: WinUIBindings,
): Record<string, NativePropertyConverter> {
  const converters: Record<string, NativePropertyConverter> = {}

  if (
    bindings.PropertyValue?.createBoolean &&
    bindings.IReference_Boolean
  ) {
    converters.isChecked = (_target, value) => {
      if (value == null || typeof value !== 'boolean') {
        return value
      }

      return bindings.IReference_Boolean?.from(
        bindings.PropertyValue?.createBoolean?.(value),
      )
    }
  }

  if (bindings.TextBlock) {
    const textContent: NativePropertyConverter = (_target, value) => {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'bigint'
      ) {
        return value
      }

      const textBlock = new bindings.TextBlock!()
      textBlock.text = String(value)
      return textBlock
    }
    converters.content = textContent
    converters.header = textContent
  }

  return converters
}

export interface WinUIThickness {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface WinUICornerRadius {
  readonly topLeft: number
  readonly topRight: number
  readonly bottomRight: number
  readonly bottomLeft: number
}

export interface WinUIColor {
  readonly a: number
  readonly r: number
  readonly g: number
  readonly b: number
}

export function thickness(
  value: number,
): WinUIThickness
export function thickness(
  horizontal: number,
  vertical: number,
): WinUIThickness
export function thickness(
  left: number,
  top: number,
  right: number,
  bottom: number,
): WinUIThickness
export function thickness(
  first: number,
  second = first,
  third = first,
  fourth = second,
): WinUIThickness {
  if (arguments.length === 2) {
    return {
      left: first,
      top: second,
      right: first,
      bottom: second,
    }
  }

  return {
    left: first,
    top: second,
    right: third,
    bottom: fourth,
  }
}

export function cornerRadius(
  value: number,
): WinUICornerRadius {
  return {
    topLeft: value,
    topRight: value,
    bottomRight: value,
    bottomLeft: value,
  }
}

export function color(
  r: number,
  g: number,
  b: number,
  a = 255,
): WinUIColor {
  return { a, r, g, b }
}

function createResourceResolver(
  bindings: WinUIBindings,
): RendererOptions['resolveResource'] | undefined {
  if (
    !bindings.Application ||
    !bindings.IMap_Object_Object ||
    !bindings.PropertyValue
  ) {
    return undefined
  }

  return (key, fallback) => {
    const application = bindings.Application?.current
    if (!application) {
      if (fallback !== undefined) {
        return fallback
      }
      throw new Error(`Application.current is unavailable while resolving "${key}".`)
    }

    const resources = application.resources.as(
      bindings.IMap_Object_Object,
    )

    try {
      return resources.lookup(
        bindings.PropertyValue?.createString(key),
      )
    } catch (error) {
      if (fallback !== undefined) {
        return fallback
      }
      throw error
    }
  }
}

export function createWinUIRenderer(
  bindings: WinUIBindings,
  options: RendererOptions = {},
): Renderer {
  const propertySetters = {
    ...createPropertySetters(bindings),
    ...options.propertySetters,
  }
  const propertyConverters = {
    ...createWinUIPropertyConverters(bindings),
    ...options.propertyConverters,
  }

  return createRenderer({
    ...options,
    propertySetters,
    propertyConverters,
    asCollection:
      options.asCollection ??
      ((value) => {
        if (
          !bindings.IVector_UIElement ||
          typeof (value as Partial<ProjectedCollection> | null)?.as !== 'function'
        ) {
          return null
        }

        return (value as ProjectedCollection).as(
          bindings.IVector_UIElement,
        )
      }),
    createText:
      options.createText ??
      (bindings.TextBlock
        ? (value) => {
            const textBlock = new bindings.TextBlock!()
            textBlock.text = value
            return textBlock
          }
        : undefined),
    resolveResource:
      options.resolveResource ??
      createResourceResolver(bindings),
  })
}
