export interface AvailableCapability<
  Value,
  Details = undefined,
> {
  readonly available: true
  readonly value: Value
  readonly details: Details
}

export interface UnavailableCapability<
  Details = undefined,
> {
  readonly available: false
  readonly reason: string
  readonly details: Details
}

export type Capability<
  Value,
  Details = undefined,
> =
  | AvailableCapability<Value, Details>
  | UnavailableCapability<Details>

export function capabilityAvailable<Value>(
  value: Value,
): AvailableCapability<Value>
export function capabilityAvailable<Value, Details>(
  value: Value,
  details: Details,
): AvailableCapability<Value, Details>
export function capabilityAvailable<Value, Details>(
  value: Value,
  details?: Details,
): AvailableCapability<Value, Details | undefined> {
  return {
    available: true,
    value,
    details,
  }
}

export function capabilityUnavailable(
  reason: string,
): UnavailableCapability
export function capabilityUnavailable<Details>(
  reason: string,
  details: Details,
): UnavailableCapability<Details>
export function capabilityUnavailable<Details>(
  reason: string,
  details?: Details,
): UnavailableCapability<Details | undefined> {
  const normalizedReason = reason.trim()
  if (!normalizedReason) {
    throw new TypeError(
      'Unavailable capabilities require a non-empty reason.',
    )
  }
  return {
    available: false,
    reason: normalizedReason,
    details,
  }
}

export function mapCapability<
  Value,
  Result,
  Details,
>(
  capability: Capability<Value, Details>,
  map: (value: Value) => Result,
): Capability<Result, Details> {
  return capability.available
    ? {
        available: true,
        value: map(capability.value),
        details: capability.details,
      }
    : capability
}

export interface CapabilityOwner<
  Value,
  Details = undefined,
> {
  readonly capability: Capability<Value, Details>
  readonly disposed: boolean
  dispose(): void
}

export function createCapabilityOwner<
  Details = undefined,
>(
  capability: UnavailableCapability<Details>,
): CapabilityOwner<never, Details>
export function createCapabilityOwner<
  Value,
  Details = undefined,
  Result = void,
>(
  capability: Capability<Value, Details>,
  cleanup: Extract<
    Result,
    PromiseLike<unknown>
  > extends never
    ? (value: Value) => Result
    : never,
): CapabilityOwner<Value, Details>
export function createCapabilityOwner<
  Value,
  Details,
>(
  capability: Capability<Value, Details>,
  cleanup?: (value: Value) => unknown,
): CapabilityOwner<Value, Details> {
  if (capability.available && !cleanup) {
    throw new TypeError(
      'Available capabilities require an owned cleanup callback.',
    )
  }
  let disposed = false
  let disposing = false
  let invalidCleanup = false
  return {
    capability,
    get disposed() {
      return disposed
    },
    dispose() {
      if (invalidCleanup) {
        throw new TypeError(
          'CapabilityOwner cleanup must be synchronous.',
        )
      }
      if (disposed || disposing) {
        return
      }
      disposing = true
      try {
        if (capability.available && cleanup) {
          const result = cleanup(capability.value)
          if (
            result !== null &&
            (
              typeof result === 'object' ||
              typeof result === 'function'
            ) &&
            'then' in result &&
            typeof result.then === 'function'
          ) {
            invalidCleanup = true
            try {
              result.then(
                () => {},
                () => {},
              )
            }
            catch {
              // The synchronous contract error remains primary.
            }
            throw new TypeError(
              'CapabilityOwner cleanup must be synchronous.',
            )
          }
        }

        disposed = true
      }
      finally {
        disposing = false
      }
    },
  }
}
