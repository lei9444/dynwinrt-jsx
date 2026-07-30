import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const BasicInputCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).BasicInputCategoryPage,
)

const ButtonPage = createLazyComponent(
  () => (require('./button') as typeof import('./button')).ButtonPage,
)

const CheckBoxPage = createLazyComponent(
  () => (require('./check-box') as typeof import('./check-box')).CheckBoxPage,
)

const ColorPickerPage = createLazyComponent(
  () => (require('./color-picker') as typeof import('./color-picker')).ColorPickerPage,
)

const ComboBoxPage = createLazyComponent(
  () => (require('./combo-box') as typeof import('./combo-box')).ComboBoxPage,
)

const DropDownButtonPage = createLazyComponent(
  () => (require('./drop-down-button') as typeof import('./drop-down-button')).DropDownButtonPage,
)

const HyperlinkButtonPage = createLazyComponent(
  () => (require('./hyperlink-button') as typeof import('./hyperlink-button')).HyperlinkButtonPage,
)

const RadioButtonPage = createLazyComponent(
  () => (require('./radio-button') as typeof import('./radio-button')).RadioButtonPage,
)

const RatingControlPage = createLazyComponent(
  () => (require('./rating-control') as typeof import('./rating-control')).RatingControlPage,
)

const RepeatButtonPage = createLazyComponent(
  () => (require('./repeat-button') as typeof import('./repeat-button')).RepeatButtonPage,
)

const SliderPage = createLazyComponent(
  () => (require('./slider') as typeof import('./slider')).SliderPage,
)

const SplitButtonPage = createLazyComponent(
  () => (require('./split-button') as typeof import('./split-button')).SplitButtonPage,
)

const ToggleButtonPage = createLazyComponent(
  () => (require('./toggle-button') as typeof import('./toggle-button')).ToggleButtonPage,
)

const ToggleSplitButtonPage = createLazyComponent(
  () => (require('./toggle-split-button') as typeof import('./toggle-split-button')).ToggleSplitButtonPage,
)

const ToggleSwitchPage = createLazyComponent(
  () => (require('./toggle-switch') as typeof import('./toggle-switch')).ToggleSwitchPage,
)

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
