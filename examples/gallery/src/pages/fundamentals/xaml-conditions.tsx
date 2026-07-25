import {
  color,
  createSolidColorBrush,
} from 'dynwinrt-jsx'
import {
  InfoBarSeverity,
  SolidColorBrush,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const featureFlags = Object.freeze({
  NewExperience: true,
  LegacyMode: false,
})

export function XamlConditionsPage(context: AppContext) {
  const newExperienceBrush = createSolidColorBrush(
    SolidColorBrush,
    color(16, 124, 16),
  )
  const legacyBrush = createSolidColorBrush(
    SolidColorBrush,
    color(196, 43, 28),
  )
  const whiteBrush = createSolidColorBrush(
    SolidColorBrush,
    color(255, 255, 255),
  )

  return (
    <Page
      title="XAML Conditions"
      subtitle="Define custom XAML conditions evaluated at parse time using IXamlCondition."
      automationId="XamlConditionsPageHeading"
      pageId="xaml-conditions"
      model={context.model}
    >
      <UI.InfoBar
        automationId="GalleryXamlConditionsInfo"
        title="Parse-time evaluation"
        isClosable={false}
        isOpen
        message="IXamlCondition is parse-time only. These samples use the original default flags (NewExperience=true, LegacyMode=false). In TSX, the equivalent flags are read once when the page component mounts; change them before rendering and restart or reload the page to see another variant."
        severity={InfoBarSeverity.Informational}
      />

      <SampleCard
        automationId="GalleryXamlConditionsSample"
        title="Conditionally include elements"
        description="The component chooses its native subtree once from startup configuration, matching the original parse-time inclusion behavior."
        code={`
const featureFlags = {
  NewExperience: true,
  LegacyMode: false,
}

{featureFlags.NewExperience ? <NewExperienceInfo /> : null}
{featureFlags.LegacyMode ? <LegacyModeInfo /> : null}
        `}
      >
        <UI.StackPanel spacing={8}>
          {featureFlags.NewExperience ? (
            <UI.InfoBar
              automationId="GalleryXamlConditionsNewExperience"
              title="New experience"
              isClosable={false}
              isOpen
              message="This InfoBar is included because the 'NewExperience' flag was true when the page was rendered."
              severity={InfoBarSeverity.Success}
            />
          ) : null}
          {featureFlags.LegacyMode ? (
            <UI.InfoBar
              automationId="GalleryXamlConditionsLegacyMode"
              title="Legacy mode"
              isClosable={false}
              isOpen
              message="This InfoBar is included because the 'LegacyMode' flag was true when the page was rendered."
              severity={InfoBarSeverity.Warning}
            />
          ) : null}
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryXamlConditionsAttributesSample"
        title="Conditionally select property values"
        description="The active startup flag chooses the Button background before the native control mounts."
        code={`
<UI.Button
  background={
    featureFlags.NewExperience
      ? newExperienceBrush
      : legacyBrush
  }
>
  Background depends on the active flag
</UI.Button>
        `}
      >
        <UI.Button
          automationId="GalleryXamlConditionsBackground"
          background={
            featureFlags.NewExperience
              ? newExperienceBrush
              : legacyBrush
          }
          foreground={whiteBrush}
        >
          Background depends on the active flag
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryXamlConditionsSettersSample"
        title="Conditionally select style values"
        description="The same startup condition selects the heading property set before TSX creates the TextBlock."
        code={`
const headingStyle = featureFlags.NewExperience
  ? { fontWeight: { weight: 600 }, fontSize: 28 }
  : { fontWeight: { weight: 400 }, fontSize: 18 }

<UI.TextBlock {...headingStyle} />
        `}
      >
        <UI.TextBlock
          automationId="GalleryXamlConditionsHeading"
          {...(featureFlags.NewExperience
            ? {
                fontWeight: { weight: 600 },
                fontSize: 28,
              }
            : {
                fontWeight: { weight: 400 },
                fontSize: 18,
              })}
          text="Heading styled with conditional values"
        />
      </SampleCard>
    </Page>
  )
}
