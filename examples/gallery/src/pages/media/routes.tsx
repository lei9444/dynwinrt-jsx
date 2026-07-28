import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { MediaCategoryPage } from './index'
import { AnimatedVisualPlayerPage } from './animated-visual-player'
import { CaptureElementPreviewPage } from './capture-element-preview'
import { ImagePage } from './image'
import { MapControlPage } from './map-control'
import { MediaPlayerElementPage } from './media-player-element'
import { PersonPicturePage } from './person-picture'
import { SoundPage } from './sound'
import { createGalleryRouteGroup } from '../route-group'

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
