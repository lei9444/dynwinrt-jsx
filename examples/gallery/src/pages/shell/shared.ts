import { Package } from '#winapp/bindings'

export interface PackageIdentityState {
  readonly available: boolean
  readonly description: string
}

export function detectPackageIdentity(): PackageIdentityState {
  try {
    const packageId = Package.current.id
    return {
      available: true,
      description: `Package identity detected (${packageId.name}).`,
    }
  }
  catch {
    return {
      available: false,
      description:
        'No package identity detected. This Gallery is running unpackaged.',
    }
  }
}

export function formatNativeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
