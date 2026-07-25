import {
  Show,
  computed,
  signal,
} from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'

export function PersonPicturePage(context: AppContext) {
  const mode = signal(0)
  const profilePicture = loadGalleryBitmap(
    'SampleMedia/treetops.jpg',
    600,
  )
  const status = computed(() => [
    'Profile type: Profile Image',
    'Profile type: Display Name',
    'Profile type: Initials',
  ][mode.value] ?? 'Profile type: Profile Image')

  return (
    <Page
      title="PersonPicture"
      subtitle="Displays the picture of a person/contact."
      automationId="PersonPicturePageHeading"
      pageId="person-picture"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaPersonPictureSample"
        title="Select different looks for a person"
        description="PersonPicture can display a photo, derive initials from a display name, or show explicit initials."
        code={`<UI.PersonPicture profilePicture={profileImage} />
<UI.PersonPicture displayName="Jane Doe" />
<UI.PersonPicture initials="SB" />`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaPersonPictureStatus"
            text={status}
          />
        }
        options={
          <UI.StackPanel spacing={4}>
            {['Profile Image', 'Display Name', 'Initials'].map(
              (name, index) => (
                <UI.RadioButton
                  key={name}
                  automationId={`GalleryMediaPersonPictureMode${index}`}
                  groupName="GalleryMediaPersonPictureType"
                  isChecked={computed(() => mode.value === index)}
                  onChecked={() => {
                    mode.value = index
                    context.model.recordInteraction()
                  }}
                >
                  {name}
                </UI.RadioButton>
              ),
            )}
          </UI.StackPanel>
        }
      >
        <Show when={computed(() => mode.value === 0)}>
          <UI.PersonPicture
            automationId="GalleryMediaPersonPictureProfile"
            height={300}
            profilePicture={profilePicture}
          />
        </Show>
        <Show when={computed(() => mode.value === 1)}>
          <UI.PersonPicture
            automationId="GalleryMediaPersonPictureDisplayName"
            height={300}
            displayName="Jane Doe"
          />
        </Show>
        <Show when={computed(() => mode.value === 2)}>
          <UI.PersonPicture
            automationId="GalleryMediaPersonPictureInitials"
            height={300}
            initials="SB"
          />
        </Show>
      </SampleCard>
    </Page>
  )
}
