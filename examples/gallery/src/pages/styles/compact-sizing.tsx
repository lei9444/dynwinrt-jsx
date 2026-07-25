import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import { Button } from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryListView,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  BulletList,
  GuidanceText,
} from '../fundamentals/shared'

export function CompactSizingPage(context: AppContext) {
  const compact = signal(false)
  const firstButton: RefObject<Button> = { current: null }
  const nativeHeight = signal(40)
  const minHeight = computed(() => compact.value ? 28 : 40)
  const controlPadding = computed(() =>
    thickness(compact.value ? 6 : 12),
  )

  return (
    <Page
      title="Compact Sizing"
      subtitle="How to use a Resource Dictionary to enable compact sizing."
      automationId="CompactSizingPageHeading"
      pageId="compact-sizing"
      model={context.model}
    >
      <GuidanceText text="Compact sizing is intended for dense productivity experiences. Apply it consistently at app, page, or control scope instead of shrinking isolated controls." />
      <BulletList
        items={[
          'ListView, TextBox, PasswordBox, and AutoSuggestBox',
          'ComboBox, DatePicker, and TimePicker',
          'TreeView, NavigationView, and MenuBar',
        ]}
      />

      <SampleCard
        automationId="GalleryStylesCompactSizingSample"
        title="Fluent Standard and Compact Sizing"
        description="Switch the same representative form between standard and compact dimensions."
        code={`
const minHeight = computed(() => compact.value ? 28 : 40)
const padding = computed(() => thickness(compact.value ? 6 : 12))
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesCompactSizingStatus"
              text={computed(() =>
                compact.value
                  ? 'Compact sizing enabled.'
                  : 'Standard sizing enabled.',
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesCompactSizingNativeStatus"
              text={computed(
                () => `Native minimum height: ${nativeHeight.value}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.RadioButton
              groupName="compact-sizing"
              isChecked={computed(() => !compact.value)}
              onChecked={() => {
                compact.value = false
                if (firstButton.current) {
                  firstButton.current.minHeight = 40
                }
                nativeHeight.value = 40
              }}
            >
              Standard
            </UI.RadioButton>
            <UI.RadioButton
              automationId="GalleryStylesCompactSizingToggle"
              groupName="compact-sizing"
              isChecked={compact}
              onChecked={() => {
                compact.value = true
                if (firstButton.current) {
                  firstButton.current.minHeight = 28
                }
                nativeHeight.value = 28
                context.model.recordInteraction()
              }}
            >
              Compact
            </UI.RadioButton>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel
          spacing={computed(() => compact.value ? 4 : 12)}
        >
          <UI.TextBox
            header="First name"
            minHeight={minHeight}
            padding={controlPadding}
          />
          <UI.PasswordBox
            header="Password"
            minHeight={minHeight}
            padding={controlPadding}
          />
          <UI.AutoSuggestBox
            placeholderText="Search"
            minHeight={minHeight}
            padding={controlPadding}
          />
          <GalleryComboBox
            header="Role"
            selectedIndex={0}
            minHeight={minHeight}
          >
            <UI.TextBlock text="Administrator" />
            <UI.TextBlock text="Editor" />
          </GalleryComboBox>
          <UI.DatePicker
            header="Start date"
            minHeight={minHeight}
          />
          <UI.TimePicker
            header="Start time"
            minHeight={minHeight}
          />
          <GalleryListView height={120}>
            {['Open', 'Save', 'Share'].map((label, index) => (
              <UI.ListViewItem key={label}>
                <UI.Button
                  {...(index === 0 ? { ref: firstButton } : {})}
                  minHeight={minHeight}
                  padding={controlPadding}
                >
                  {label}
                </UI.Button>
              </UI.ListViewItem>
            ))}
          </GalleryListView>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
