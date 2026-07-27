import {
  capabilityAvailable,
  capabilityUnavailable,
  type Capability,
} from 'dynwinrt-jsx'
import { Package } from '#winapp/bindings'

export type PackageIdentityState = Capability<string>

export function detectPackageIdentity(): PackageIdentityState {
  try {
    const packageId = Package.current.id
    return capabilityAvailable(packageId.name)
  }
  catch {
    return capabilityUnavailable(
      'No package identity detected. This Gallery is running unpackaged.',
    )
  }
}

export function formatNativeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
