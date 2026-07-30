import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const TextCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).TextCategoryPage,
)

const AutoSuggestBoxPage = createLazyComponent(
  () => (require('./auto-suggest-box') as typeof import('./auto-suggest-box')).AutoSuggestBoxPage,
)

const NumberBoxPage = createLazyComponent(
  () => (require('./number-box') as typeof import('./number-box')).NumberBoxPage,
)

const PasswordBoxPage = createLazyComponent(
  () => (require('./password-box') as typeof import('./password-box')).PasswordBoxPage,
)

const RichEditBoxPage = createLazyComponent(
  () => (require('./rich-edit-box') as typeof import('./rich-edit-box')).RichEditBoxPage,
)

const RichTextBlockPage = createLazyComponent(
  () => (require('./rich-text-block') as typeof import('./rich-text-block')).RichTextBlockPage,
)

const TextBlockPage = createLazyComponent(
  () => (require('./text-block') as typeof import('./text-block')).TextBlockPage,
)

const TextBoxPage = createLazyComponent(
  () => (require('./text-box') as typeof import('./text-box')).TextBoxPage,
)

export function createTextRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-text',
    path: '/text',
    renderIndex: (value) => <TextCategoryPage {...value} />,
    pages: [
      { id: 'auto-suggest-box', render: (value) => <AutoSuggestBoxPage {...value} /> },
      { id: 'number-box', render: (value) => <NumberBoxPage {...value} /> },
      { id: 'password-box', render: (value) => <PasswordBoxPage {...value} /> },
      { id: 'rich-edit-box', render: (value) => <RichEditBoxPage {...value} /> },
      { id: 'rich-text-block', render: (value) => <RichTextBlockPage {...value} /> },
      { id: 'text-block', render: (value) => <TextBlockPage {...value} /> },
      { id: 'text-box', render: (value) => <TextBoxPage {...value} /> },
    ],
  })
}
