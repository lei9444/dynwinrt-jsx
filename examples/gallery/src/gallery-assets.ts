import { createBitmapImage, createUri } from 'dynwinrt-jsx'
import {
  BitmapImage,
  SvgImageSource,
  Uri,
} from '#winapp/bindings'

declare const process: {
  cwd(): string
}

export type BitmapImageInstance = InstanceType<typeof BitmapImage>

export function createGalleryAssetUri(
  relativePath: string,
): Uri {
  const assetRoot = process.cwd().replaceAll('\\', '/')
  return createUri(
    Uri,
    encodeURI(`file:///${assetRoot}/Assets/${relativePath}`),
  )
}

export function loadGalleryBitmap(
  relativePath: string,
  decodePixelWidth: number,
): BitmapImageInstance {
  return createBitmapImage(
    BitmapImage,
    createGalleryAssetUri(relativePath),
    { decodePixelWidth },
  )
}

export function loadGallerySvg(
  relativePath: string,
): SvgImageSource {
  return new SvgImageSource(
    createGalleryAssetUri(relativePath),
  )
}
