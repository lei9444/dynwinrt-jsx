import { computed, signal, styles } from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  TextWrapping,
} from '#winapp/bindings'
import type { AppContext } from '../../gallery-ui'
import { UI } from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'

export function ButtonPage(context: AppContext) {
  const enabled = signal(true)
  const clicks = signal(0)
  const image = loadGalleryBitmap('ControlImages/Button.png', 32)

  const recordClick = () => {
    clicks.value += 1
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Button"
      subtitle="Use text, images, and native button styles for direct actions."
      automationId="ButtonPageHeading"
      pageId="button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputButtonSample"
        title="Button content and state"
        description="A signal controls enabled state while Click updates the output."
        code={`
const enabled = signal(true)
const clicks = signal(0)
<UI.Button isEnabled={enabled} onClick={() => clicks.value += 1}>
  Standard button
</UI.Button>
        `}
        output={
          <UI.TextBlock
            text={computed(() => `You clicked the button ${clicks.value} times.`)}
          />
        }
        options={
          <UI.CheckBox
            isChecked={computed(() => !enabled.value)}
            onChecked={() => {
              enabled.value = false
            }}
            onUnchecked={() => {
              enabled.value = true
            }}
          >
            Disable button
          </UI.CheckBox>
        }
      >
        <UI.Button
          automationId="GalleryBasicInputButtonControl"
          isEnabled={enabled}
          onClick={recordClick}
        >
          Standard button
        </UI.Button>
      </SampleCard>
      <SampleCard
        title="Image and accent buttons"
        description="Button content can be a native image, and the accent recipe emphasizes a primary action."
        code={`
<UI.Button automationName="Button image">
  <UI.Image source={image} width={32} height={32} />
</UI.Button>
<UI.Button {...styles.button({ variant: 'accent' })}>Save</UI.Button>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Button automationName="Button image" onClick={recordClick}>
            <UI.Image source={image} width={32} height={32} />
          </UI.Button>
          <UI.Button
            {...styles.button({ variant: 'accent' })}
            onClick={recordClick}
          >
            Save changes
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Wrapping button content"
        description="Stretch buttons when space is available, or wrap their content explicitly at a constrained width."
        code={`
<UI.Button horizontalAlignment={HorizontalAlignment.Stretch}>
  A button that can grow with its container
</UI.Button>
<UI.Button maxWidth={240}>
  <UI.TextBlock
    text="Long button content wraps instead of clipping"
    textWrapping={TextWrapping.WrapWholeWords}
  />
</UI.Button>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Button
            horizontalAlignment={HorizontalAlignment.Stretch}
            onClick={recordClick}
          >
            This button stretches so its longer content has room
          </UI.Button>
          <UI.Button maxWidth={240} onClick={recordClick}>
            <UI.TextBlock
              text="This is longer button content that wraps instead of being clipped"
              textWrapping={TextWrapping.WrapWholeWords}
            />
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
