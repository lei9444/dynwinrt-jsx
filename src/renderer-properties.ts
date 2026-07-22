import type {
  NativeAdapter,
} from './adapters'
import { ChangeEchoSuppressor } from './change-echo'
import {
  afterReactiveFlush,
  effect,
  isSignal,
  onCleanup,
  runInScope,
  signal,
  type ReactiveScope,
} from './reactive'
import {
  isResourceReference,
  type ResourceReference,
} from './resource'
import {
  replaceNativeCollection,
  requireNativeArray,
} from './native-collection'
import type {
  RendererErrorContext,
  RendererOptions,
} from './renderer'

type ComponentPropertySetter = (
  instance: object,
  property: string,
  value: unknown,
) => boolean

type RendererErrorHandler = (
  error: unknown,
  context: RendererErrorContext,
  scope: ReactiveScope,
) => void

interface ControlledPropertyBinding {
  readonly suppressor: ChangeEchoSuppressor<unknown>
  desiredValue: unknown
  hasDesiredValue: boolean
  revision: number
}

const reservedProperties = new Set([
  'children',
  'key',
  'ref',
])

function isEventProperty(
  target: Record<string, unknown>,
  property: string,
  value: unknown,
): boolean {
  const callback = isSignal(value) ? value.peek() : value
  return (
    property.startsWith('on') &&
    typeof callback === 'function' &&
    typeof target[property] === 'function'
  )
}

export class RendererPropertyService {
  constructor(
    private readonly options: RendererOptions,
    private readonly handleError: RendererErrorHandler,
  ) {}

  applyProperties(
    target: object,
    props: Record<string, unknown>,
    componentSetter: ComponentPropertySetter | undefined,
    adapters:
      | Record<string, NativeAdapter<object> | undefined>
      | undefined,
    scope: ReactiveScope,
  ): void {
    const controlledBindings =
      this.bindControlledProperties(
        target,
        props,
        adapters,
        scope,
      )

    for (const [property, sourceValue] of Object.entries(props)) {
      if (scope.disposed) {
        return
      }
      if (
        reservedProperties.has(property) ||
        controlledBindings.changeProperties.has(property) ||
        adapters?.[property]?.kind === 'slot' ||
        adapters?.[property]?.kind === 'itemsRepeater' ||
        isEventProperty(
          target as Record<string, unknown>,
          property,
          sourceValue,
        )
      ) {
        continue
      }

      if (isSignal(sourceValue)) {
        if (
          adapters?.[property]?.kind === 'property' &&
          adapters[property].mode === 'initialOnly'
        ) {
          this.assignProperty(
            target,
            property,
            this.resolvePropertyValue(
              target,
              property,
              sourceValue.peek(),
            ),
            componentSetter,
            adapters[property],
            controlledBindings.bindings.get(property),
            scope,
          )
          continue
        }
        this.bindProperty(
          target,
          property,
          () => sourceValue.value,
          componentSetter,
          adapters?.[property],
          controlledBindings.bindings.get(property),
          scope,
        )
      }
      else if (
        this.getResourceObservationKind(
          target,
          property,
          sourceValue,
        )
      ) {
        this.bindProperty(
          target,
          property,
          () => sourceValue,
          componentSetter,
          adapters?.[property],
          controlledBindings.bindings.get(property),
          scope,
        )
      }
      else {
        this.assignProperty(
          target,
          property,
          this.resolvePropertyValue(
            target,
            property,
            sourceValue,
          ),
          componentSetter,
          adapters?.[property],
          controlledBindings.bindings.get(property),
          scope,
        )
      }
    }
  }

  applyEvents(
    target: object,
    props: Record<string, unknown>,
    adapters:
      | Record<string, NativeAdapter<object> | undefined>
      | undefined,
    scope: ReactiveScope,
  ): void {
    const record = target as Record<string, unknown>
    const controlledChangeProperties = new Set(
      Object.values(adapters ?? {})
        .map((adapter) =>
          adapter?.kind === 'property'
            ? adapter.controlled?.changeProperty
            : undefined,
        )
        .filter(
          (property): property is string =>
            property !== undefined,
        ),
    )

    for (const [property, callbackSource] of Object.entries(props)) {
      if (
        controlledChangeProperties.has(property) ||
        !isEventProperty(record, property, callbackSource)
      ) {
        continue
      }

      try {
        const callback = (...args: unknown[]) => {
          const current = isSignal(callbackSource)
            ? callbackSource.peek()
            : callbackSource
          return (current as (...values: unknown[]) => unknown)(...args)
        }
        const unsubscribe = (
          record[property] as (handler: unknown) => unknown
        ).call(target, callback)

        if (typeof unsubscribe === 'function') {
          runInScope(scope, () => {
            onCleanup(unsubscribe as () => void)
          })
        }
      }
      catch (error) {
        this.handleError(error, {
          phase: 'event',
          target,
          property,
        }, scope)
      }
    }
  }

  private bindProperty(
    target: object,
    property: string,
    readSource: () => unknown,
    componentSetter: ComponentPropertySetter | undefined,
    adapter: NativeAdapter<object> | undefined,
    controlledBinding: ControlledPropertyBinding | undefined,
    scope: ReactiveScope,
  ): void {
    const resourceRevision = signal(0)
    let observedKind: ResourceReference['kind'] | undefined
    let unsubscribe: (() => void) | undefined
    const stopObserving = (): unknown => {
      const cleanup = unsubscribe
      unsubscribe = undefined
      observedKind = undefined
      try {
        cleanup?.()
        return undefined
      }
      catch (error) {
        return error
      }
    }

    runInScope(scope, () => {
      onCleanup(() => {
        const error = stopObserving()
        if (error !== undefined) {
          throw error
        }
      })
      effect(() => {
        const source = readSource()
        let observationError: unknown
        const observationKind = this.getResourceObservationKind(
          target,
          property,
          source,
        )
        if (observationKind) {
          resourceRevision.value
          if (observedKind !== observationKind) {
            if (observedKind) {
              observationError = stopObserving()
            }
            observedKind = observationKind
            const cleanup = this.options.observeResourceChanges?.(
              target,
              () => {
                resourceRevision.value =
                  resourceRevision.peek() + 1
              },
              observationKind,
            )
            if (typeof cleanup === 'function') {
              unsubscribe = cleanup
            }
          }
        }
        else if (observedKind) {
          observationError = stopObserving()
        }
        this.assignProperty(
          target,
          property,
          this.resolvePropertyValue(
            target,
            property,
            source,
          ),
          componentSetter,
          adapter,
          controlledBinding,
          scope,
        )
        if (
          observationError !== undefined &&
          !scope.disposed
        ) {
          this.handleError(
            observationError,
            { phase: 'event', target, property },
            scope,
          )
        }
      })
    })
  }

  private getResourceObservationKind(
    target: object,
    property: string,
    value: unknown,
  ): ResourceReference['kind'] | undefined {
    if (isResourceReference(value)) {
      return value.kind
    }
    return this.options.getResourceObservationKind?.(
      property,
      value,
      target,
    )
  }

  private assignProperty(
    target: object,
    property: string,
    value: unknown,
    componentSetter: ComponentPropertySetter | undefined,
    adapter: NativeAdapter<object> | undefined,
    controlledBinding: ControlledPropertyBinding | undefined,
    scope: ReactiveScope,
  ): void {
    try {
      if (adapter?.kind === 'collection') {
        const values = requireNativeArray(value, property)
        const mapped = adapter.map
          ? values.map((item, index) =>
              adapter.map!(item, index, target),
            )
          : values
        replaceNativeCollection(
          adapter.get(target),
          mapped,
          adapter.label ??
            `${target.constructor.name}.${property}`,
        )
        return
      }

      if (adapter?.kind === 'property') {
        if (adapter.coerce) {
          value = adapter.coerce(value, target)
        }
        if (adapter.controlled) {
          if (controlledBinding) {
            controlledBinding.desiredValue = value
            controlledBinding.hasDesiredValue = true
            controlledBinding.revision += 1
          }
          this.writeControlledProperty(
            target,
            property,
            value,
            adapter.controlled,
            controlledBinding?.suppressor,
          )
          return
        }
        if (adapter.set) {
          adapter.set(target, value)
          return
        }
      }

      if (componentSetter?.(target, property, value)) {
        return
      }

      const namedSetter =
        this.options.propertySetters?.[property]
      if (namedSetter) {
        namedSetter(target, value, scope)
        return
      }

      if (
        this.options.setProperty?.(
          target,
          property,
          value,
        )
      ) {
        return
      }

      if (property in target) {
        ;(target as Record<string, unknown>)[property] = value
        return
      }

      if (this.options.onUnknownProperty) {
        this.options.onUnknownProperty(
          target,
          property,
          value,
        )
        return
      }

      throw new Error(
        `Unknown JSX property ${target.constructor.name}.${property}.`,
      )
    }
    catch (error) {
      this.handleError(error, {
        phase: 'property',
        target,
        property,
      }, scope)
    }
  }

  private writeControlledProperty(
    target: object,
    property: string,
    value: unknown,
    controlled: NonNullable<
      Extract<NativeAdapter<object>, { kind: 'property' }>['controlled']
    >,
    suppressor: ChangeEchoSuppressor<unknown> | undefined,
  ): void {
    const current = controlled.read(target)
    const equals = controlled.equals ?? Object.is
    if (equals(value, current)) {
      return
    }

    suppressor?.record(value)
    try {
      controlled.write(target, value)
    }
    catch (error) {
      suppressor?.clear()
      if (controlled.rollback) {
        suppressor?.record(current)
        try {
          controlled.rollback(
            target,
            current,
            value,
            error,
          )
        }
        catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `${target.constructor.name}.${property} write and rollback failed.`,
          )
        }
        finally {
          suppressor?.finishWrite()
        }
      }
      throw error
    }
    finally {
      suppressor?.finishWrite()
    }
  }

  private resolvePropertyValue(
    target: object,
    property: string,
    source: unknown,
  ): unknown {
    let value = source

    if (isResourceReference(value)) {
      if (!this.options.resolveResource) {
        if (value.fallback !== undefined) {
          value = value.fallback
        }
        else {
          throw new Error(
            `No resource resolver is configured for "${value.key}".`,
          )
        }
      }
      else {
        value = this.options.resolveResource(
          value.key,
          value.fallback,
          target,
          value.kind,
        )
      }
    }

    const namedConverter =
      this.options.propertyConverters?.[property]
    if (namedConverter) {
      value = namedConverter(target, value, property)
    }

    if (this.options.convertProperty) {
      value = this.options.convertProperty(
        target,
        value,
        property,
      )
    }

    return value
  }

  private bindControlledProperties(
    target: object,
    props: Record<string, unknown>,
    adapters:
      | Record<string, NativeAdapter<object> | undefined>
      | undefined,
    scope: ReactiveScope,
  ): {
    bindings: Map<string, ControlledPropertyBinding>
    changeProperties: Set<string>
  } {
    const bindings =
      new Map<string, ControlledPropertyBinding>()
    const changeProperties = new Set<string>()

    for (const [property, adapter] of Object.entries(
      adapters ?? {},
    )) {
      if (
        adapter?.kind !== 'property' ||
        !adapter.controlled
      ) {
        continue
      }

      const controlled = adapter.controlled
      changeProperties.add(controlled.changeProperty)
      const callbackSource =
        props[controlled.changeProperty]
      if (
        !isSignal(callbackSource) &&
        typeof callbackSource !== 'function'
      ) {
        continue
      }

      const suppressor =
        new ChangeEchoSuppressor<unknown>({
          mode: controlled.echo,
          equals: controlled.equals,
          maxPending: controlled.maxPendingWrites,
        })
      const binding: ControlledPropertyBinding = {
        suppressor,
        desiredValue: undefined,
        hasDesiredValue: false,
        revision: 0,
      }

      try {
        const cleanup = controlled.subscribe(
          target,
          () => {
            const value = controlled.read(target)
            if (suppressor.consume(value)) {
              return
            }
            const revision = binding.revision
            const callback = isSignal(callbackSource)
              ? callbackSource.peek()
              : callbackSource
            let callbackError: unknown
            try {
              if (typeof callback === 'function') {
                callback(value, target)
              }
            }
            catch (error) {
              callbackError = error
            }

            afterReactiveFlush(() => {
              let reassertError: unknown
              if (
                !scope.disposed &&
                binding.hasDesiredValue &&
                binding.revision === revision
              ) {
                try {
                  this.writeControlledProperty(
                    target,
                    property,
                    binding.desiredValue,
                    controlled,
                    suppressor,
                  )
                }
                catch (error) {
                  reassertError = error
                }
              }

              if (
                callbackError !== undefined &&
                reassertError !== undefined
              ) {
                this.handleError(
                  new AggregateError(
                    [callbackError, reassertError],
                    `${target.constructor.name}.${property} change callback and model reassertion failed.`,
                  ),
                  {
                    phase: 'event',
                    target,
                    property: controlled.changeProperty,
                  },
                  scope,
                )
              }
              else if (callbackError !== undefined) {
                this.handleError(
                  callbackError,
                  {
                    phase: 'event',
                    target,
                    property: controlled.changeProperty,
                  },
                  scope,
                )
              }
              else if (reassertError !== undefined) {
                this.handleError(
                  reassertError,
                  {
                    phase: 'property',
                    target,
                    property,
                  },
                  scope,
                )
              }
            })
          },
        )
        bindings.set(property, binding)
        runInScope(scope, () => {
          onCleanup(() => {
            suppressor.clear()
            cleanup?.()
          })
        })
      }
      catch (error) {
        this.handleError(error, {
          phase: 'event',
          target,
          property,
        }, scope)
      }
    }

    return { bindings, changeProperties }
  }
}
