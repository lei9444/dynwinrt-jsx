import {
  For,
  Show,
  computed,
  onCleanup,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AddDeleteThemeTransition,
  ContentThemeTransition,
  EntranceThemeTransition,
  FocusState,
  HorizontalAlignment,
  Orientation,
  Popup,
  PopupThemeTransition,
  RepositionThemeTransition,
  TextAlignment,
  TextWrapping,
  TransitionCollection,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  type ButtonInstance,
  GalleryListView,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  releaseMotionResources,
  useMotionSettings,
} from './shared'

function transitionCollection(
  transition:
    | EntranceThemeTransition
    | RepositionThemeTransition
    | ContentThemeTransition
    | AddDeleteThemeTransition
    | PopupThemeTransition,
) {
  const collection = new TransitionCollection()
  collection.append(transition)
  return collection
}

export function ThemeTransitionsPage(context: AppContext) {
  const motion = useMotionSettings()
  const emptyTransitions = new TransitionCollection()
  const entrance = new EntranceThemeTransition()
  entrance.isStaggeringEnabled = true
  const reposition = new RepositionThemeTransition()
  const content = new ContentThemeTransition()
  const addDelete = new AddDeleteThemeTransition()
  const popupTransition = new PopupThemeTransition()
  const entranceTransitions = transitionCollection(entrance)
  const repositionTransitions = transitionCollection(reposition)
  const contentTransitions = transitionCollection(content)
  const addDeleteTransitions = transitionCollection(addDelete)
  const popupTransitions = transitionCollection(popupTransition)
  const enabledCollection = (
    collection: TransitionCollection,
  ) =>
    computed(() =>
      motion.enabled.value ? collection : emptyTransitions)

  let nextEntranceId = 6
  const entranceItems = signal<readonly number[]>([
    1, 2, 3, 4, 5,
  ])
  const middleVisible = signal(true)
  const refreshed = signal(false)
  const contentItems = computed(() =>
    Array.from({ length: 5 }, (_, index) =>
      refreshed.value
        ? `Updated content ${index}`
        : `Item ${index}`),
  )
  let nextItem = 10
  const addDeleteItems = signal<readonly string[]>(
    Array.from({ length: 10 }, (_, index) => `Item ${index}`),
  )
  const popup: RefObject<Popup> = { current: null }
  let mountedPopup: Popup | null = null
  const showPopupButton: RefObject<ButtonInstance> = {
    current: null,
  }
  const closePopupButton: RefObject<ButtonInstance> = {
    current: null,
  }

  onCleanup(() => {
    let firstError: unknown
    try {
      if (mountedPopup) {
        mountedPopup.isOpen = false
      }
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      releaseMotionResources([
        entranceTransitions,
        repositionTransitions,
        contentTransitions,
        addDeleteTransitions,
        popupTransitions,
        emptyTransitions,
        entrance,
        reposition,
        content,
        addDelete,
        popupTransition,
      ])
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
    mountedPopup = null
  })

  return (
    <Page
      title="Theme Transitions"
      subtitle="Theme transitions are pre-packaged, easy-to-apply animations."
      automationId="ThemeTransitionsPageHeading"
      pageId="theme-transitions"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionThemeTransitionsStatus"
        settings={motion}
      />
      <UI.TextBlock
        automationId="GalleryMotionThemeTransitionsResult"
        text={computed(() =>
          `Entrance items: ${entranceItems.value.length}`)}
      />

      <SampleCard
        title="Use the EntranceThemeTransition when adding items to your page."
        description="Items added to a panel enter with the system entrance motion and optional staggering."
        code={`const transition = new EntranceThemeTransition()
transition.isStaggeringEnabled = true
panel.childrenTransitions = transitionCollection(transition)
items.value = [...items.value, nextItem]`}
        options={
          <UI.StackPanel spacing={8}>
            <UI.Button
              automationId="GalleryMotionThemeTransitionsAdd"
              onClick={() => {
                entranceItems.value = [
                  ...entranceItems.value,
                  nextEntranceId++,
                ]
              }}
            >
              Add one
            </UI.Button>
            <UI.Button
              onClick={() => {
                entranceItems.value = [
                  ...entranceItems.value,
                  ...Array.from({ length: 5 }, () =>
                    nextEntranceId++),
                ]
              }}
            >
              Add five
            </UI.Button>
            <UI.Button
              onClick={() => {
                entranceItems.value = []
              }}
            >
              Clear all
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          childrenTransitions={enabledCollection(
            entranceTransitions,
          )}
        >
          <For each={entranceItems}>
            {(item) => (
              <UI.Rectangle
                width={50}
                height={50}
                margin={thickness(5)}
                fill={theme.accent}
                automationName={`Entrance rectangle ${item}`}
              />
            )}
          </For>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Use the RepositionThemeTransition to react to layout changes."
        description="Hide or restore the middle element and let the final element animate to its new layout position."
        code={`rectangle.transitions =
  transitionCollection(new RepositionThemeTransition())
middle.visibility =
  middle.visibility === Visibility.Visible
    ? Visibility.Collapsed
    : Visibility.Visible`}
        options={
          <UI.Button
            onClick={() => {
              middleVisible.value = !middleVisible.value
              context.model.recordInteraction()
            }}
          >
            Reposition
          </UI.Button>
        }
      >
        <UI.StackPanel orientation={Orientation.Horizontal}>
          <UI.Rectangle
            width={75}
            height={75}
            margin={thickness(5)}
            fill={theme.ref('SystemFillColorCriticalBrush')}
          />
          <UI.Rectangle
            width={75}
            height={75}
            margin={thickness(5)}
            fill={theme.ref('SystemFillColorSuccessBrush')}
            visibility={computed(() =>
              middleVisible.value
                ? Visibility.Visible
                : Visibility.Collapsed)}
          />
          <UI.Rectangle
            width={75}
            height={75}
            margin={thickness(5)}
            fill={theme.accent}
            transitions={enabledCollection(
              repositionTransitions,
            )}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Use ContentThemeTransition to animate content refreshes."
        description="Refresh the list to replace its five visible content items."
        code={`list.itemContainerTransitions =
  transitionCollection(new ContentThemeTransition())
items.value = items.value.map(
  (_, index) => \`Updated content \${index}\`,
)`}
        options={
          <UI.Button
            onClick={() => {
              refreshed.value = !refreshed.value
              context.model.recordInteraction()
            }}
          >
            Refresh data
          </UI.Button>
        }
      >
        <GalleryListView
          itemContainerTransitions={enabledCollection(
            contentTransitions,
          )}
        >
          <For each={contentItems}>
            {(item) => <UI.TextBlock text={item} />}
          </For>
        </GalleryListView>
      </SampleCard>

      <SampleCard
        title="Use AddDeleteThemeTransition to animate adding and removing items from a collection."
        description="Add, delete, or replace the first item while the remaining collection reflows."
        code={`list.itemContainerTransitions =
  transitionCollection(new AddDeleteThemeTransition())
items.value = [...items.value, \`New Item \${nextItem++}\`]`}
        options={
          <UI.StackPanel spacing={8}>
            <UI.Button
              onClick={() => {
                addDeleteItems.value = [
                  ...addDeleteItems.value,
                  `New Item ${nextItem++}`,
                ]
              }}
            >
              Add
            </UI.Button>
            <UI.Button
              onClick={() => {
                addDeleteItems.value =
                  addDeleteItems.value.slice(1)
              }}
            >
              Delete
            </UI.Button>
            <UI.Button
              onClick={() => {
                addDeleteItems.value = [
                  ...addDeleteItems.value.slice(1),
                  `New Item ${nextItem++}`,
                ]
              }}
            >
              Add and Del
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <GalleryListView
          itemContainerTransitions={enabledCollection(
            addDeleteTransitions,
          )}
        >
          <For each={addDeleteItems}>
            {(item) => <UI.TextBlock text={item} />}
          </For>
        </GalleryListView>
      </SampleCard>

      <SampleCard
        title="Use PopupThemeTransition to animate opening and closing a popup."
        description="The popup uses the native system popup transition and restores keyboard focus when it closes."
        code={`popup.childTransitions =
  transitionCollection(new PopupThemeTransition())
popup.isOpen = true
closeButton.focus(FocusState.Programmatic)`}
      >
        <UI.Grid>
          <UI.Button
            ref={showPopupButton}
            onClick={() => {
              if (popup.current) {
                popup.current.isOpen = true
                closePopupButton.current?.focus(
                  FocusState.Programmatic,
                )
              }
            }}
          >
            Show Popup
          </UI.Button>
          <UI.Popup
            ref={(value) => {
              popup.current = value
              if (value) {
                mountedPopup = value
                value.xamlRoot =
                  context.window.content.xamlRoot
              }
            }}
            margin={thickness(-75)}
            childTransitions={enabledCollection(
              popupTransitions,
            )}
          >
            <UI.Border
              width={240}
              padding={thickness(24)}
              background={theme.cardBackground}
              borderBrush={theme.cardStroke}
              borderThickness={thickness(2)}
              cornerRadius={{ topLeft: 120, topRight: 120, bottomRight: 120, bottomLeft: 120 }}
            >
              <UI.StackPanel spacing={12}>
                <UI.TextBlock
                  text="This is a popup using PopupThemeTransition"
                  textAlignment={TextAlignment.Center}
                  textWrapping={TextWrapping.WrapWholeWords}
                />
                <UI.Button
                  ref={closePopupButton}
                  horizontalAlignment={HorizontalAlignment.Center}
                  onClick={() => {
                    if (popup.current) {
                      popup.current.isOpen = false
                    }
                    showPopupButton.current?.focus(
                      FocusState.Programmatic,
                    )
                  }}
                >
                  Close Popup
                </UI.Button>
              </UI.StackPanel>
            </UI.Border>
          </UI.Popup>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
