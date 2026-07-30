import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const MediaCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).MediaCategoryPage,
)

const AnimatedVisualPlayerPage = createLazyComponent(
  () => (require('./animated-visual-player') as typeof import('./animated-visual-player')).AnimatedVisualPlayerPage,
)

const CaptureElementPreviewPage = createLazyComponent(
  () => (require('./capture-element-preview') as typeof import('./capture-element-preview')).CaptureElementPreviewPage,
)

const ImagePage = createLazyComponent(
  () => (require('./image') as typeof import('./image')).ImagePage,
)

const MapControlPage = createLazyComponent(
  () => (require('./map-control') as typeof import('./map-control')).MapControlPage,
)

const MediaPlayerElementPage = createLazyComponent(
  () => (require('./media-player-element') as typeof import('./media-player-element')).MediaPlayerElementPage,
)

const PersonPicturePage = createLazyComponent(
  () => (require('./person-picture') as typeof import('./person-picture')).PersonPicturePage,
)

const SoundPage = createLazyComponent(
  () => (require('./sound') as typeof import('./sound')).SoundPage,
)

export function createMediaRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-media',
    path: '/media',
    renderIndex: (value) => <MediaCategoryPage {...value} />,
    pages: [
      { id: 'animated-visual-player', render: (value) => <AnimatedVisualPlayerPage {...value} /> },
      { id: 'capture-element-preview', render: (value) => <CaptureElementPreviewPage {...value} /> },
      { id: 'image', render: (value) => <ImagePage {...value} /> },
      { id: 'map-control', render: (value) => <MapControlPage {...value} /> },
      { id: 'media-player-element', render: (value) => <MediaPlayerElementPage {...value} /> },
      { id: 'person-picture', render: (value) => <PersonPicturePage {...value} /> },
      { id: 'sound', render: (value) => <SoundPage {...value} /> },
    ],
  })
}
