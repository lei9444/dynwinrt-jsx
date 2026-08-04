import {
  createBitmapImage,
  createUri,
  type ProjectedOwnership,
} from 'dynwinrt-jsx'
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
  ownProjected?: ProjectedOwnership['ownProjected'],
): Uri {
  const assetRoot = process.cwd().replaceAll('\\', '/')
  const uri = createUri(
    Uri,
    encodeURI(`file:///${assetRoot}/Assets/${relativePath}`),
  )
  return ownProjected ? ownProjected(uri) : uri
}

export function loadGalleryBitmap(
  relativePath: string,
  decodePixelWidth: number,
  ownProjected?: ProjectedOwnership['ownProjected'],
): BitmapImageInstance {
  const bitmap = createBitmapImage(
    BitmapImage,
    createGalleryAssetUri(relativePath, ownProjected),
    { decodePixelWidth },
  )
  return ownProjected ? ownProjected(bitmap) : bitmap
}

export function loadGallerySvg(
  relativePath: string,
): SvgImageSource {
  return new SvgImageSource(
    createGalleryAssetUri(relativePath),
  )
}
