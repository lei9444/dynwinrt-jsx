import {
  color,
  computed,
  createSolidColorBrush,
  resource,
  signal,
  theme,
  thickness,
  tokens,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  SolidColorBrush,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type BorderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'
import {
  BulletList,
  GuidanceSection,
  GuidanceText,
} from './shared'

export function ResourcesPage(context: AppContext) {
  const primaryBrush = createSolidColorBrush(
    SolidColorBrush,
    color(0, 120, 212),
  )
  const highlightBrush = createSolidColorBrush(
    SolidColorBrush,
    color(169, 77, 193),
  )
  const whiteBrush = createSolidColorBrush(
    SolidColorBrush,
    color(255, 255, 255),
  )
  const localBrush = createSolidColorBrush(
    SolidColorBrush,
    color(226, 36, 26),
  )
  const lightBackground = createSolidColorBrush(
    SolidColorBrush,
    color(238, 238, 238),
  )
  const lightText = createSolidColorBrush(
    SolidColorBrush,
    color(51, 51, 51),
  )
  const darkBackground = createSolidColorBrush(
    SolidColorBrush,
    color(51, 51, 51),
  )
  const darkText = createSolidColorBrush(
    SolidColorBrush,
    color(238, 238, 238),
  )
  lightBackground.opacity = 0.91
  darkBackground.opacity = 0.73
  const fallbackBackground = createSolidColorBrush(
    SolidColorBrush,
    color(255, 0, 255),
  )
  fallbackBackground.opacity = 0.11
  const lightImage = loadGalleryBitmap(
    'SampleMedia/Light_Image.png',
    640,
  )
  const darkImage = loadGalleryBitmap(
    'SampleMedia/Dark_Image.png',
    640,
  )
  const themedBorder: RefObject<BorderInstance> = {
    current: null,
  }
  const nativeThemeStatus = signal(
    'Native background opacity: not inspected',
  )
  const inspectNativeTheme = () => {
    const current = themedBorder.current
    if (!current) {
      throw new Error('Theme resource sample is not mounted.')
    }
    nativeThemeStatus.value =
      `Native background opacity: ${current.background.opacity.toFixed(2)}`
  }
  return (
    <Page
      title="Resources"
      subtitle="Reusable definitions for shared values to ensure consistency and maintainability."
      automationId="ResourcesPageHeading"
      pageId="resources"
      model={context.model}
    >
      <GuidanceSection title="Creating and using XAML resources">
        <GuidanceText text="XAML resources are defined in a ResourceDictionary. Each entry has a unique key and a reusable value such as a color, brush, string, style, or template." />
        <BulletList
          items={[
            'App-level resources are available throughout the application.',
            'Page-level resources are scoped to one page.',
            'Control-level resources are scoped to one control subtree.',
          ]}
        />
        <GuidanceText text="Use descriptive keys, define resources at the narrowest useful scope, and resolve them from TSX with resource(key) or theme.ref(key)." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryResourcesSample"
        title="Create and use resources at different scopes"
        description="resourceOverrides creates real element-level ResourceDictionary entries, while resource() resolves the nearest matching key."
        code={`
<UI.StackPanel resourceOverrides={{ PrimaryColor: primaryBrush }}>
  <UI.Border background={resource('PrimaryColor')}>
    <UI.StackPanel resourceOverrides={{ BackgroundColor: localBrush }}>
      <UI.Border background={resource('BackgroundColor')} />
    </UI.StackPanel>
  </UI.Border>
</UI.StackPanel>
        `}
      >
        <UI.StackPanel
          resourceOverrides={{
            PrimaryColor: primaryBrush,
            HighlightBrush: highlightBrush,
            FontColor: whiteBrush,
          }}
          spacing={8}
          padding={thickness(8)}
          background={resource('PrimaryColor', primaryBrush)}
          cornerRadius={tokens.radius.control}
        >
          <UI.TextBlock
            fontSize={24}
            foreground={resource('FontColor', whiteBrush)}
            text="Using application-level resources"
          />
          <UI.StackPanel
            margin={thickness(8)}
            padding={thickness(8)}
            spacing={8}
            background={resource('HighlightBrush', highlightBrush)}
            cornerRadius={tokens.radius.control}
          >
            <UI.TextBlock
              fontSize={18}
              foreground={resource('FontColor', whiteBrush)}
              text="Using page-level resources"
            />
            <UI.StackPanel
              resourceOverrides={{
                BackgroundColor: localBrush,
              }}
              margin={thickness(8)}
              padding={thickness(8)}
              cornerRadius={tokens.radius.control}
            >
              <UI.Border
                padding={thickness(8)}
                background={resource('BackgroundColor', localBrush)}
                cornerRadius={tokens.radius.control}
              >
                <UI.TextBlock
                  foreground={resource('FontColor', whiteBrush)}
                  text="Using control-level resources"
                />
              </UI.Border>
            </UI.StackPanel>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Theme resources">
        <GuidanceText text="WinUI includes theme resources for common colors and control states. ThemeResource references update when the requested theme changes; StaticResource references keep the value resolved when the property was assigned." />
        <BulletList
          items={[
            'Use theme.ref(key) for dynamic theme-aware resource lookup.',
            'Use ResourceDictionary theme dictionaries when your app defines different light and dark values.',
            'Provide a fallback when a resource may not exist in every target environment.',
          ]}
        />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryResourcesStaticThemeSample"
        title="StaticResource versus ThemeResource"
        description="Toggle the Gallery theme in the title bar to compare a one-time static lookup with a theme-aware lookup."
        code={`
<UI.Border background={resource('SolidBackgroundFillColorBaseBrush')}>
  <UI.TextBlock foreground={resource('TextFillColorPrimaryBrush')} />
</UI.Border>
<UI.Border background={theme.ref('SolidBackgroundFillColorBaseBrush')}>
  <UI.TextBlock foreground={theme.ref('TextFillColorPrimaryBrush')} />
</UI.Border>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Border
            padding={thickness(12)}
            background={resource('SolidBackgroundFillColorBaseBrush')}
          >
            <UI.TextBlock
              foreground={resource('TextFillColorPrimaryBrush')}
              text="StaticResource uses the value resolved when this page was mounted and does not refresh automatically."
              textWrapping={TextWrapping.Wrap}
            />
          </UI.Border>
          <UI.Border
            padding={thickness(12)}
            background={theme.ref('SolidBackgroundFillColorBaseBrush')}
          >
            <UI.TextBlock
              foreground={theme.ref('TextFillColorPrimaryBrush')}
              text="ThemeResource adapts automatically when the Gallery switches between light and dark themes."
              textWrapping={TextWrapping.Wrap}
            />
          </UI.Border>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryResourcesThemeDictionarySample"
        title="Define light and dark theme resources"
        description="The scoped dictionary stores both brush variants. The same theme signal selects the active resource, label, and projected image."
        code={`
<UI.Border resourceOverrides={allThemeResources}>
  <UI.TextBlock text={computed(() =>
    isDark.value ? 'Dark theme' : 'Light theme')} />
  <UI.Image source={computed(() => isDark.value ? darkImage : lightImage)} />
</UI.Border>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryResourcesNativeStatus"
            text={nativeThemeStatus}
          />
        }
        options={
          <UI.Button
            automationId="GalleryResourcesVerifyNative"
            onClick={() => {
              inspectNativeTheme()
              context.model.recordInteraction()
            }}
          >
            Verify native resource
          </UI.Button>
        }
      >
        <UI.Border
          ref={themedBorder}
          resourceOverrides={{
            LightBackgroundBrush: lightBackground,
            LightTextBrush: lightText,
            DarkBackgroundBrush: darkBackground,
            DarkTextBrush: darkText,
          }}
          maxWidth={700}
          padding={thickness(8)}
          background={computed(() =>
            context.model.darkTheme.value
              ? resource('DarkBackgroundBrush', fallbackBackground)
              : resource('LightBackgroundBrush', lightBackground),
          )}
          cornerRadius={tokens.radius.control}
          horizontalAlignment={HorizontalAlignment.Center}
        >
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryResourcesThemeName"
              fontSize={20}
              foreground={computed(() =>
                context.model.darkTheme.value
                  ? resource('DarkTextBrush', darkText)
                  : resource('LightTextBrush', lightText),
              )}
              text={computed(() =>
                context.model.darkTheme.value
                  ? 'Dark theme'
                  : 'Light theme',
              )}
            />
            <UI.Image
              height={260}
              source={computed(() =>
                context.model.darkTheme.value
                  ? darkImage
                  : lightImage,
              )}
            />
          </UI.StackPanel>
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
