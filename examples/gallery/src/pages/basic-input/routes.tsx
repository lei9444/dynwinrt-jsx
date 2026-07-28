import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { BasicInputCategoryPage } from './index'
import { ButtonPage } from './button'
import { CheckBoxPage } from './check-box'
import { ColorPickerPage } from './color-picker'
import { ComboBoxPage } from './combo-box'
import { DropDownButtonPage } from './drop-down-button'
import { HyperlinkButtonPage } from './hyperlink-button'
import { RadioButtonPage } from './radio-button'
import { RatingControlPage } from './rating-control'
import { RepeatButtonPage } from './repeat-button'
import { SliderPage } from './slider'
import { SplitButtonPage } from './split-button'
import { ToggleButtonPage } from './toggle-button'
import { ToggleSplitButtonPage } from './toggle-split-button'
import { ToggleSwitchPage } from './toggle-switch'
import { createGalleryRouteGroup } from '../route-group'

export function createBasicInputRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-basic-input',
    path: '/basic-input',
    renderIndex: (value) => (
      <BasicInputCategoryPage {...value} />
    ),
    pages: [
      { id: 'button', render: (value) => <ButtonPage {...value} /> },
      { id: 'drop-down-button', render: (value) => <DropDownButtonPage {...value} /> },
      { id: 'hyperlink-button', render: (value) => <HyperlinkButtonPage {...value} /> },
      { id: 'repeat-button', render: (value) => <RepeatButtonPage {...value} /> },
      { id: 'toggle-button', render: (value) => <ToggleButtonPage {...value} /> },
      { id: 'split-button', render: (value) => <SplitButtonPage {...value} /> },
      { id: 'toggle-split-button', render: (value) => <ToggleSplitButtonPage {...value} /> },
      { id: 'check-box', render: (value) => <CheckBoxPage {...value} /> },
      { id: 'color-picker', render: (value) => <ColorPickerPage {...value} /> },
      { id: 'combo-box', render: (value) => <ComboBoxPage {...value} /> },
      { id: 'radio-button', render: (value) => <RadioButtonPage {...value} /> },
      { id: 'rating-control', render: (value) => <RatingControlPage {...value} /> },
      { id: 'slider', render: (value) => <SliderPage {...value} /> },
      { id: 'toggle-switch', render: (value) => <ToggleSwitchPage {...value} /> },
    ],
  })
}
