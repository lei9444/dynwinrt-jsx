import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { TextCategoryPage } from './index'
import { AutoSuggestBoxPage } from './auto-suggest-box'
import { NumberBoxPage } from './number-box'
import { PasswordBoxPage } from './password-box'
import { RichEditBoxPage } from './rich-edit-box'
import { RichTextBlockPage } from './rich-text-block'
import { TextBlockPage } from './text-block'
import { TextBoxPage } from './text-box'
import { createGalleryRouteGroup } from '../route-group'

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
