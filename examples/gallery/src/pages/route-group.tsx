import {
  Outlet,
  type Child,
  type RouteDefinition,
} from 'dynwinrt-jsx'
import type { AppContext } from '../gallery-ui'
import type {
  GalleryPageId,
} from '../gallery-data'

export interface GalleryPageRoute {
  readonly id: GalleryPageId
  readonly render: (context: AppContext) => Child
}

export interface GalleryRouteGroupOptions {
  readonly id: string
  readonly path: string
  readonly renderIndex: (context: AppContext) => Child
  readonly pages: readonly GalleryPageRoute[]
}

export function createGalleryRouteGroup(
  context: AppContext,
  options: GalleryRouteGroupOptions,
): readonly RouteDefinition[] {
  return [{
    id: options.id,
    path: options.path,
    parentId: 'home',
    render: () => (
      <Outlet fallback={options.renderIndex(context)} />
    ),
    children: options.pages.map((page) => ({
      id: page.id,
      path: page.id,
      render: () => page.render(context),
    })),
  }]
}
