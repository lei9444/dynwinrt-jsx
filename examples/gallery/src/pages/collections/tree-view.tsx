import {
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  FontIcon,
  Image,
  Orientation,
  PropertyValue,
  releaseProjected,
  StackPanel,
  TextBlock,
  TreeView,
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
import { loadGalleryBitmap } from '../../gallery-assets'

function createTreeNodeFactory(context: AppContext) {
  const labelByNativeIdentity = new Map<string, string>()
  const createNode = (
    content: string | object,
    children: readonly TreeViewNode[] = [],
    isExpanded = false,
    label = typeof content === 'string' ? content : '',
  ): TreeViewNode => {
    const node = context.createProjected(
      () => new TreeViewNode(),
    )
    node.content =
      typeof content === 'string'
        ? PropertyValue.createString(content)
        : content
    node.isExpanded = isExpanded
    const nativeValue = Reflect.get(node, '_obj')
    if (nativeValue !== undefined) {
      labelByNativeIdentity.set(
        String(nativeValue),
        label,
      )
    }
    for (const child of children) {
      node.children.append(child)
    }
    return node
  }
  const createExplorerRoots = (): readonly TreeViewNode[] => [
    createNode(
      'Work Documents',
      [
        createNode('XYZ Functional Spec'),
        createNode('Feature Schedule'),
      ],
      true,
    ),
    createNode(
      'Personal Documents',
      [
        createNode(
          'Home Remodel',
          [
            createNode('Contractor Contact Info'),
            createNode('Paint Color Scheme'),
          ],
          true,
        ),
      ],
      true,
    ),
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
  } = createTreeNodeFactory(context)
  const invokedStatus = signal('Invoke or move a node.')
  const selectionStatus = signal('Selected nodes: 0')
  const multiTree: RefObject<TreeView> = { current: null }
  const multiRoots = createExplorerRoots()
  const dataRoots = createExplorerRoots()
  const folderSource = loadGalleryBitmap(
    'SampleMedia/folder.png',
    20,
    context.ownProjected,
  )
  const visualContent = (name: string, folder: boolean) => {
    const panel = context.createProjected(
      () => new StackPanel(),
    )
    panel.orientation = Orientation.Horizontal
    const children = panel.children
    try {
      if (folder) {
        const image = context.createProjected(() => new Image())
        image.width = 20
        image.source = folderSource
        children.append(image)
      }
      else {
        const icon = context.createProjected(
          () => new FontIcon(),
        )
        icon.glyph = '\uE8A5'
        children.append(icon)
      }
      const label = context.createProjected(
        () => new TextBlock(),
      )
      label.margin = thickness(10, 0, 0, 0)
      label.text = name
      children.append(label)
    }
    finally {
      releaseProjected(children)
    }
    return panel
  }
  const templateRoots = [
    createNode(
      visualContent('Documents', true),
      [
        createNode(
          visualContent('ProjectProposal', false),
          [],
          false,
          'ProjectProposal',
        ),
        createNode(
          visualContent('BudgetReport', false),
          [],
          false,
          'BudgetReport',
        ),
      ],
      true,
      'Documents',
    ),
    createNode(
      visualContent('Projects', true),
      [
        createNode(
          visualContent('Project Plan', false),
          [],
          false,
          'Project Plan',
        ),
      ],
      true,
      'Projects',
    ),
  ]

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
        title="TreeView with drag and drop"
        description="TreeView supports expandable nodes and native drag behavior."
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
      >
        <UI.Border
          height={280}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
        >
          <GalleryTreeView
            automationId="GalleryCollectionsTreeViewControl"
            minWidth={345}
            maxHeight={400}
            margin={thickness(0, 12, 0, 0)}
            horizontalAlignment={HorizontalAlignment.Center}
            rootNodes={createExplorerRoots()}
            allowDrop
            canDragItems
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
      >
        <UI.Border
          height={280}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
        >
          <GalleryTreeView
            ref={multiTree}
            automationId="GalleryCollectionsTreeViewSelectionControl"
            minWidth={345}
            maxHeight={400}
            margin={thickness(0, 12, 0, 0)}
            horizontalAlignment={HorizontalAlignment.Center}
            rootNodes={multiRoots}
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
        automationId="GalleryCollectionsTreeViewDataSample"
        title="Hierarchical root nodes"
        description="Create the same folder hierarchy with projected TreeViewNode data."
        code={`
<GalleryTreeView rootNodes={roots} />
        `}
      >
        <UI.Border
          height={200}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
        >
          <GalleryTreeView
            minWidth={345}
            maxHeight={400}
            margin={thickness(0, 12, 0, 0)}
            horizontalAlignment={HorizontalAlignment.Center}
            rootNodes={dataRoots}
            selectionMode={TreeViewSelectionMode.Single}
          />
        </UI.Border>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsTreeViewTemplateSample"
        title="Folder and file visuals"
        description="Folder and file nodes use distinct projected native content."
        code={`
<GalleryTreeView rootNodes={explorerRoots} />
        `}
      >
        <UI.Border
          height={200}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
        >
          <GalleryTreeView
            minWidth={345}
            maxHeight={400}
            margin={thickness(0, 12, 0, 0)}
            horizontalAlignment={HorizontalAlignment.Center}
            rootNodes={templateRoots}
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
