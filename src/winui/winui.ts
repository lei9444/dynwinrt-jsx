import {
  createRenderer,
  isNativeCollection,
  type NativeCollection,
  type NativePropertyConverter,
  type NativePropertySetter,
  type Renderer,
  type RendererOptions,
} from '../renderer/renderer'
import {
  createWinUIResourceRuntime,
  type WinUIResourceBindings,
} from './winui-resources'

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

export interface WinUIBindings extends WinUIResourceBindings {
  readonly IVector_UIElement?: unknown
  readonly TextBlock?: TextBlockConstructor
  readonly Grid?: object
  readonly Canvas?: object
  readonly AutomationProperties?: object
  readonly PropertyValue?: PropertyValueType
  readonly IReference_Boolean?: ReferenceBooleanType
}

export interface AttachedPropertyRegistration {
  readonly owner?: object
  readonly method: string
  readonly optional?: boolean
}

export type AttachedPropertyRegistrations = Record<
  string,
  AttachedPropertyRegistration
>

export type WinUIRendererCapability =
  | 'text'
  | 'nullableBoolean'
  | 'uiElementCollections'
  | 'resources'
  | 'resourceOverrides'
  | 'grid'
  | 'canvas'
  | 'automation'

export type WinUIRendererCapabilities = Readonly<
  Record<WinUIRendererCapability, boolean>
>

export interface WinUIRendererOptions extends RendererOptions {
  readonly attachedProperties?: AttachedPropertyRegistrations
}

export interface WinUIRendererPreset {
  readonly capabilities: WinUIRendererCapabilities
  createRenderer(options?: WinUIRendererOptions): Renderer
}

function hasStaticMethods(
  owner: object | undefined,
  methods: readonly string[],
): boolean {
  const record = owner as Record<string, unknown> | undefined
  return methods.every(
    (method) => typeof record?.[method] === 'function',
  )
}

function createCapabilities(
  bindings: WinUIBindings,
): WinUIRendererCapabilities {
  const resources = Boolean(
    bindings.Application &&
    bindings.IMap_Object_Object &&
    bindings.PropertyValue?.createString,
  )
  return Object.freeze({
    text: typeof bindings.TextBlock === 'function',
    nullableBoolean: Boolean(
      bindings.PropertyValue?.createBoolean &&
      bindings.IReference_Boolean?.from,
    ),
    uiElementCollections:
      bindings.IVector_UIElement !== undefined,
    resources,
    resourceOverrides:
      resources &&
      typeof bindings.ResourceDictionary === 'function',
    grid: hasStaticMethods(bindings.Grid, [
      'setRow',
      'setColumn',
      'setRowSpan',
      'setColumnSpan',
    ]),
    canvas: hasStaticMethods(bindings.Canvas, [
      'setLeft',
      'setTop',
    ]),
    automation: hasStaticMethods(
      bindings.AutomationProperties,
      [
        'setAutomationId',
        'setName',
        'setHelpText',
        'setLabeledBy',
        'setHeadingLevel',
        'setPositionInSet',
        'setSizeOfSet',
        'setLiveSetting',
        'setIsDialog',
        'setAutomationControlType',
      ],
    ),
  })
}

function missingCapability(
  feature: string,
  bindings: readonly string[],
): Error {
  return new Error(
    `${feature} requires generated WinUI bindings for ${bindings.join(
      ' and ',
    )}. Pass the full generated binding namespace to createWinUIRendererPreset() or createWinUIRenderer().`,
  )
}

export function createWinUIRendererPreset(
  bindings: WinUIBindings,
): WinUIRendererPreset {
  const capabilities = createCapabilities(bindings)
  return Object.freeze({
    capabilities,
    createRenderer(options: WinUIRendererOptions = {}) {
      return createWinUIRenderer(bindings, options)
    },
  })
}

export function createAttachedPropertySetters(
  registrations: AttachedPropertyRegistrations,
): Record<string, NativePropertySetter> {
  const setters: Record<string, NativePropertySetter> = {}
  for (const [property, registration] of Object.entries(registrations)) {
    addStaticSetter(
      setters,
      property,
      registration.owner,
      registration.method,
      registration.optional ?? false,
    )
  }
  return setters
}

function addStaticSetter(
  setters: Record<string, NativePropertySetter>,
  property: string,
  type: object | undefined,
  method: string,
  optional: boolean,
): void {
  const setter = (type as Record<string, unknown> | undefined)?.[method]
  if (typeof setter !== 'function') {
    if (optional) {
      return
    }
    throw new Error(
      `Attached property ${property} requires static method ${method}.`,
    )
  }

  setters[property] = (target, value) => {
    ;(setter as (element: object, value: unknown) => void).call(
      type,
      target,
      value,
    )
  }
}

export function createWinUIAttachedPropertyRegistrations(
  bindings: WinUIBindings,
): AttachedPropertyRegistrations {
  return {
    gridRow: { owner: bindings.Grid, method: 'setRow', optional: true },
    gridColumn: { owner: bindings.Grid, method: 'setColumn', optional: true },
    gridRowSpan: {
      owner: bindings.Grid,
      method: 'setRowSpan',
      optional: true,
    },
    gridColumnSpan: {
      owner: bindings.Grid,
      method: 'setColumnSpan',
      optional: true,
    },
    canvasLeft: {
      owner: bindings.Canvas,
      method: 'setLeft',
      optional: true,
    },
    canvasTop: {
      owner: bindings.Canvas,
      method: 'setTop',
      optional: true,
    },
    automationId: {
      owner: bindings.AutomationProperties,
      method: 'setAutomationId',
      optional: true,
    },
    automationName: {
      owner: bindings.AutomationProperties,
      method: 'setName',
      optional: true,
    },
    automationHelpText: {
      owner: bindings.AutomationProperties,
      method: 'setHelpText',
      optional: true,
    },
    automationLabeledBy: {
      owner: bindings.AutomationProperties,
      method: 'setLabeledBy',
      optional: true,
    },
    automationHeadingLevel: {
      owner: bindings.AutomationProperties,
      method: 'setHeadingLevel',
      optional: true,
    },
    automationPositionInSet: {
      owner: bindings.AutomationProperties,
      method: 'setPositionInSet',
      optional: true,
    },
    automationSizeOfSet: {
      owner: bindings.AutomationProperties,
      method: 'setSizeOfSet',
      optional: true,
    },
    automationLiveSetting: {
      owner: bindings.AutomationProperties,
      method: 'setLiveSetting',
      optional: true,
    },
    automationIsDialog: {
      owner: bindings.AutomationProperties,
      method: 'setIsDialog',
      optional: true,
    },
    automationControlType: {
      owner: bindings.AutomationProperties,
      method: 'setAutomationControlType',
      optional: true,
    },
  }
}

export function createWinUIPropertyConverters(
  bindings: WinUIBindings,
): Record<string, NativePropertyConverter> {
  const converters: Record<string, NativePropertyConverter> = {
    isChecked: (_target, value) => {
      if (value == null || typeof value !== 'boolean') {
        return value
      }
      if (
        !bindings.PropertyValue?.createBoolean ||
        !bindings.IReference_Boolean?.from
      ) {
        throw missingCapability(
          'Boolean isChecked conversion',
          ['PropertyValue', 'IReference_Boolean'],
        )
      }
      return bindings.IReference_Boolean.from(
        bindings.PropertyValue.createBoolean(value),
      )
    },
    content: (_target, value) => {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'bigint'
      ) {
        return value
      }
      if (!bindings.TextBlock) {
        throw missingCapability(
          'Primitive content conversion',
          ['TextBlock'],
        )
      }
      const textBlock = new bindings.TextBlock()
      textBlock.text = String(value)
      return textBlock
    },
    header: (_target, value) => {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'bigint'
      ) {
        return value
      }
      if (!bindings.TextBlock) {
        throw missingCapability(
          'Primitive header conversion',
          ['TextBlock'],
        )
      }
      const textBlock = new bindings.TextBlock()
      textBlock.text = String(value)
      return textBlock
    }
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

export function createWinUIRenderer(
  bindings: WinUIBindings,
  options: WinUIRendererOptions = {},
): Renderer {
  const resourceRuntime = createWinUIResourceRuntime(
    bindings,
    options.resolveResource,
  )
  const observeResourceChanges =
    resourceRuntime || options.observeResourceChanges
      ? (
          target: object,
          callback: () => void,
          kind: 'static' | 'theme',
        ) => {
          const cleanups: Array<() => void> = []
          try {
            for (const observe of [
              resourceRuntime?.observeResourceChanges,
              options.observeResourceChanges,
            ]) {
              const cleanup = observe?.(target, callback, kind)
              if (typeof cleanup === 'function') {
                cleanups.push(cleanup)
              }
            }
          }
          catch (error) {
            let cleanupError: unknown
            for (const cleanup of cleanups.reverse()) {
              try {
                cleanup()
              }
              catch (failure) {
                cleanupError ??= failure
              }
            }
            if (cleanupError !== undefined) {
              throw new AggregateError(
                [error, cleanupError],
                'Resource observers failed to initialize and roll back.',
              )
            }
            throw error
          }
          return () => {
            let firstError: unknown
            for (const cleanup of cleanups.reverse()) {
              try {
                cleanup()
              }
              catch (error) {
                firstError ??= error
              }
            }
            if (firstError !== undefined) {
              throw firstError
            }
          }
        }
      : undefined
  const propertySetters = {
    ...createAttachedPropertySetters({
      ...createWinUIAttachedPropertyRegistrations(bindings),
      ...options.attachedProperties,
    }),
    ...(resourceRuntime
      ? { resourceOverrides: resourceRuntime.resourceOverridesSetter }
      : {}),
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
        if (isNativeCollection(value)) {
          return value
        }
        const projected =
          value as Partial<ProjectedCollection> | null
        if (typeof projected?.as !== 'function') {
          return null
        }
        if (!bindings.IVector_UIElement) {
          throw missingCapability(
            'Projected UIElement collection conversion',
            ['IVector_UIElement'],
          )
        }
        return projected.as(
          bindings.IVector_UIElement,
        )
      }),
    createText:
      options.createText ??
      ((value) => {
        if (!bindings.TextBlock) {
          throw missingCapability(
            'Primitive JSX child conversion',
            ['TextBlock'],
          )
        }
        const textBlock = new bindings.TextBlock()
        textBlock.text = value
        return textBlock
      }),
    resolveResource:
      options.resolveResource ??
      resourceRuntime?.resolveResource,
    observeResourceChanges:
      observeResourceChanges,
    getResourceObservationKind:
      resourceRuntime || options.getResourceObservationKind
        ? (property, value, target) =>
            resourceRuntime?.getResourceObservationKind(
              property,
              value,
              target,
            ) ??
            options.getResourceObservationKind?.(
              property,
              value,
              target,
            )
        : undefined,
  })
}
