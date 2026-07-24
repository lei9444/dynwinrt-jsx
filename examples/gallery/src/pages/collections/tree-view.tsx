import {
  signal,
  theme,
  thickness,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  PropertyValue,
  TreeViewNode,
  TreeViewSelectionMode,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryTreeView,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'

function createTreeNodeFactory() {
  const labelByNativeIdentity = new Map<string, string>()
  const createNode = (
    content: string,
    children: readonly TreeViewNode[] = [],
    isExpanded = false,
  ): TreeViewNode => {
    const node = new TreeViewNode()
    node.content = PropertyValue.createString(content)
    node.isExpanded = isExpanded
    const nativeValue = Reflect.get(node, '_obj')
    if (nativeValue !== undefined) {
      labelByNativeIdentity.set(
        String(nativeValue),
        content,
      )
    }
    for (const child of children) {
      node.children.append(child)
    }
    return node
  }
  const createExplorerRoots = (): readonly TreeViewNode[] => [
    createNode(
      'Documents',
      [
        createNode(
          'Projects',
          [
            createNode('gallery.tsx'),
            createNode('renderer.ts'),
          ],
          true,
        ),
        createNode('notes.txt'),
      ],
      true,
    ),
    createNode(
      'Pictures',
      [
        createNode('cliff.jpg'),
        createNode('sunset.jpg'),
      ],
      true,
    ),
    createNode('Downloads', [
      createNode('dynwinrt-jsx.zip'),
    ]),
  ]
  return {
    createNode,
    createExplorerRoots,
    readInvokedNodeLabel(value: unknown): string {
      return labelByNativeIdentity.get(String(value)) ??
        'Unknown node'
    },
  }
}

export function TreeViewPage(context: AppContext) {
  const {
    createNode,
    createExplorerRoots,
    readInvokedNodeLabel,
  } = createTreeNodeFactory()
  const invokedStatus = signal('Invoke or move a node.')
  const selectionStatus = signal('Selected nodes: 0')
  const canDrag = signal(true)
  const dynamicRoots = signal<readonly TreeViewNode[]>(
    createExplorerRoots(),
  )
  let nextFolder = 1

  return (
    <Page
      title="TreeView"
      subtitle="Display expandable hierarchical collections with native node selection and reordering."
      automationId="TreeViewPageHeading"
      pageId="tree-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsTreeViewSample"
        title="Hierarchical nodes and drag"
        description="TreeViewNode owns child node collections; TreeView can expose native drag and reorder behavior for the hierarchy."
        code={`
const root = new TreeViewNode()
root.content = PropertyValue.createString('Documents')
root.children.append(projectsNode)

<GalleryTreeView
  rootNodes={[root]}
  canDragItems
  canReorderItems
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsTreeViewStatus"
            text={invokedStatus}
          />
        }
        options={
          <UI.CheckBox
            isChecked={canDrag}
            onChecked={() => {
              canDrag.value = true
            }}
            onUnchecked={() => {
              canDrag.value = false
            }}
          >
            Enable drag and reorder
          </UI.CheckBox>
        }
      >
        <UI.Border
          width={380}
          height={300}
          padding={thickness(8)}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
          horizontalAlignment={HorizontalAlignment.Left}
        >
          <GalleryTreeView
            automationId="GalleryCollectionsTreeViewControl"
            rootNodes={createExplorerRoots()}
            allowDrop={canDrag}
            canDragItems={canDrag}
            canReorderItems={canDrag}
            selectionMode={TreeViewSelectionMode.Single}
            onItemInvoked={(_sender, args) => {
              invokedStatus.value =
                `Invoked: ${readInvokedNodeLabel(args.invokedItem)}`
              context.model.recordInteraction()
            }}
          />
        </UI.Border>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsTreeViewSelectionSample"
        title="Multiple selection"
        description="Multiple selection adds native selection affordances and exposes the selected node collection."
        code={`
<GalleryTreeView
  rootNodes={roots}
  selectionMode={TreeViewSelectionMode.Multiple}
  onSelectionChanged={(sender) => {
    count.value = sender.selectedNodes.size
  }}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsTreeViewSelectionStatus"
            text={selectionStatus}
          />
        }
      >
        <UI.Border
          width={380}
          height={300}
          padding={thickness(8)}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
          horizontalAlignment={HorizontalAlignment.Left}
        >
          <GalleryTreeView
            rootNodes={createExplorerRoots()}
            selectionMode={TreeViewSelectionMode.Multiple}
            onSelectionChanged={(sender) => {
              selectionStatus.value =
                `Selected nodes: ${sender.selectedNodes.size}`
              context.model.recordInteraction()
            }}
          />
        </UI.Border>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsTreeViewDynamicSample"
        title="Update root nodes"
        description="A collection adapter synchronizes projected TreeViewNode objects transactionally when roots are added or removed."
        code={`
const roots = signal(createRoots())
<GalleryTreeView rootNodes={roots} />
        `}
        options={
          <UI.StackPanel spacing={8}>
            <UI.Button
              automationId="GalleryCollectionsTreeViewAddRoot"
              onClick={() => {
                const folder = nextFolder
                nextFolder += 1
                dynamicRoots.value = [
                  ...dynamicRoots.value,
                  createNode(
                    `New folder ${folder}`,
                    [createNode(`File ${folder}.txt`)],
                    true,
                  ),
                ]
                context.model.recordInteraction()
              }}
            >
              Add root
            </UI.Button>
            <UI.Button
              onClick={() => {
                if (dynamicRoots.value.length === 0) {
                  return
                }
                dynamicRoots.value =
                  dynamicRoots.value.slice(0, -1)
                context.model.recordInteraction()
              }}
            >
              Remove root
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Border
          width={380}
          height={300}
          padding={thickness(8)}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
          horizontalAlignment={HorizontalAlignment.Left}
        >
          <GalleryTreeView
            rootNodes={dynamicRoots}
            selectionMode={TreeViewSelectionMode.Single}
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
