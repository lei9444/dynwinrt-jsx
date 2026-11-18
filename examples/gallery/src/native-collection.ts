export function requireCollection<T extends object>(
  collection: T | null,
  property: string,
): T {
  if (collection === null) {
    throw new Error(`${property} returned no collection.`)
  }
  return collection
}
