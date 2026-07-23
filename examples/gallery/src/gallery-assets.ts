import { createBitmapImage, createUri } from 'dynwinrt-jsx'
import { BitmapImage, Uri } from '#winapp/bindings'

declare const process: {
  cwd(): string
}

export type BitmapImageInstance = InstanceType<typeof BitmapImage>

export function loadGalleryBitmap(
  relativePath: string,
  decodePixelWidth: number,
): BitmapImageInstance {
  const assetRoot = process.cwd().replaceAll('\\', '/')
  return createBitmapImage(
    BitmapImage,
    createUri(
      Uri,
      encodeURI(`file:///${assetRoot}/Assets/${relativePath}`),
    ),
    { decodePixelWidth },
  )
}
