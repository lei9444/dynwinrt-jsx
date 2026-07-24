import type { BitmapImageInstance } from '../../gallery-assets'
import { loadGalleryBitmap } from '../../gallery-assets'

export interface CollectionPhoto {
  readonly id: number
  readonly title: string
  readonly detail: string
  readonly source: BitmapImageInstance
}

const photoData = [
  ['Cliff', 'Rocky cliffs above the water.', 'cliff.jpg'],
  ['Grapes', 'A cluster of ripe grapes.', 'grapes.jpg'],
  ['Rainier', 'Mount Rainier above the clouds.', 'rainier.jpg'],
  ['Sunset', 'A colorful sunset over the horizon.', 'sunset.jpg'],
  ['Valley', 'A green valley surrounded by hills.', 'valley.jpg'],
] as const

export function createCollectionPhotos(
  decodePixelWidth = 640,
): readonly CollectionPhoto[] {
  return photoData.map(([title, detail, file], id) => ({
    id,
    title,
    detail,
    source: loadGalleryBitmap(
      `SampleMedia/${file}`,
      decodePixelWidth,
    ),
  }))
}
