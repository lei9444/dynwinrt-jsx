import {
  createFontFamily,
  styles,
  theme,
} from 'dynwinrt-jsx'
import { FontFamily, TextWrapping } from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  BulletList,
  GuidanceSection,
  GuidanceText,
} from './shared'

const customButtonStyle = {
  ...styles.button({ variant: 'accent' }),
  background: theme.ref(
    'AccentAcrylicBackgroundFillColorDefaultBrush',
  ),
  minWidth: 200,
}

function ImplicitTextStyle(props: {
  readonly text: string
}) {
  return (
    <UI.TextBlock
      fontSize={16}
      fontFamily={createFontFamily(FontFamily, 'Consolas')}
      fontWeight={{ weight: 700 }}
      text={props.text}
      textWrapping={TextWrapping.Wrap}
    />
  )
}

export function StylePage(context: AppContext) {
  return (
    <Page
      title="Style"
      subtitle="A style is a reusable collection of property settings for consistent UI design."
      automationId="StylePageHeading"
      pageId="style"
      model={context.model}
    >
      <GuidanceSection>
        <GuidanceText text="Styles can be defined at application, page, or control scope, just like other resources." />
        <BulletList
          items={[
            'A style is a reusable collection of property settings for one control type.',
            'A keyed style is applied explicitly, while an implicit style applies automatically within its intended scope.',
            'Styles reduce repetition and keep visual decisions consistent and maintainable.',
          ]}
        />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryStyleSample"
        title="Create and apply an explicit style recipe"
        description="A typed TSX property recipe is the dynwinrt-jsx equivalent of a keyed XAML Style. Local props can still override individual values."
        code={`
const customButtonStyle = {
  ...styles.button({ variant: 'accent' }),
  background: theme.ref(
    'AccentAcrylicBackgroundFillColorDefaultBrush',
  ),
  minWidth: 200,
}

<UI.Button {...customButtonStyle}>Styled button</UI.Button>
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.Button>Default button</UI.Button>
          <UI.Button
            automationId="GalleryStyleNativeStyledButton"
            {...customButtonStyle}
          >
            Styled button
          </UI.Button>
          <UI.Button
            {...customButtonStyle}
            background={theme.systemCriticalBackground}
          >
            Styled button (overridden)
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryStyleImplicitSample"
        title="Apply a scoped implicit component style"
        description="TSX does not hide an unkeyed style in parser state. A small wrapper makes the scope and the automatically applied property set explicit."
        code={`
function ImplicitTextStyle(props) {
  return (
    <UI.TextBlock
      fontSize={16}
      fontFamily={consolas}
      fontWeight={{ weight: 700 }}
    >
      {props.children}
    </UI.TextBlock>
  )
}
        `}
      >
        <UI.StackPanel spacing={4}>
          <ImplicitTextStyle text="This style is applied automatically!" />
          <ImplicitTextStyle text="No need to repeat the properties." />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
