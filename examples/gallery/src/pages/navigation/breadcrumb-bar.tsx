import { signal } from 'dynwinrt-jsx'
import {
  IObservableVector_Object,
  PropertyValue,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const initialFolders = [
  'Home',
  'Documents',
  'Design',
  'Northwind',
  'Images',
] as const

export function BreadcrumbBarPage(context: AppContext) {
  const visibleFolders = [...initialFolders]
  const items = IObservableVector_Object.create(
    visibleFolders.map((folder) =>
      PropertyValue.createString(folder),
    ),
  )
  const status = signal(
    `Current location: ${visibleFolders.at(-1)}`,
  )
  const trimAfter = (index: number) => {
    while (visibleFolders.length > index + 1) {
      visibleFolders.pop()
      items.removeAtEnd()
    }
    status.value =
      `Current location: ${visibleFolders.at(-1) ?? 'None'}`
    context.model.recordInteraction()
  }
  const reset = () => {
    items.clear()
    visibleFolders.splice(0, visibleFolders.length)
    for (const folder of initialFolders) {
      visibleFolders.push(folder)
      items.append(PropertyValue.createString(folder))
    }
    status.value = `Current location: ${visibleFolders.at(-1)}`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="BreadcrumbBar"
      subtitle="Shows the trail of navigation taken to the current location."
      automationId="BreadcrumbBarPageHeading"
      pageId="breadcrumb-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBreadcrumbBarSample"
        title="A mutable navigation path"
        description="Selecting an earlier node removes the folders that follow it, while reset restores the original path."
        code={`
const folders = IObservableVector_Object.create(
  names.map((name) => PropertyValue.createString(name)),
)

<UI.BreadcrumbBar
  itemsSource={folders}
  onItemClicked={(_sender, args) => trimAfter(args.index)}
/>
        `}
        output={<UI.TextBlock text={status} />}
        options={
          <UI.Button
            automationId="GalleryBreadcrumbBarReset"
            onClick={reset}
          >
            Reset path
          </UI.Button>
        }
      >
        <UI.BreadcrumbBar
          automationId="GalleryBreadcrumbBarControl"
          itemsSource={items}
          onItemClicked={(_sender, args) => {
            trimAfter(args.index)
          }}
        />
      </SampleCard>
    </Page>
  )
}
