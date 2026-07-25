import {
  createFontFamily,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  FontFamily,
  ScrollBarVisibility,
  ScrollMode,
  TextBlock,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { GuidanceText } from '../fundamentals/shared'
import {
  DesignTableHeader,
  DesignTableRow,
  DesignTableScroller,
  DesignThemeImage,
} from './shared'

interface TypeRampEntry {
  readonly name: string
  readonly variableFont: string
  readonly size: number
  readonly lineHeight: number
  readonly weight: number
  readonly resource: string
}

const typeRamp: readonly TypeRampEntry[] = [
  {
    name: 'Caption',
    variableFont: 'Small, Regular',
    size: 12,
    lineHeight: 16,
    weight: 400,
    resource: 'CaptionTextBlockStyle',
  },
  {
    name: 'Body',
    variableFont: 'Text, Regular',
    size: 14,
    lineHeight: 20,
    weight: 400,
    resource: 'BodyTextBlockStyle',
  },
  {
    name: 'Body Strong',
    variableFont: 'Text, SemiBold',
    size: 14,
    lineHeight: 20,
    weight: 600,
    resource: 'BodyStrongTextBlockStyle',
  },
  {
    name: 'Body Large',
    variableFont: 'Text, Regular',
    size: 18,
    lineHeight: 24,
    weight: 400,
    resource: 'BodyLargeTextBlockStyle',
  },
  {
    name: 'Body Large Strong',
    variableFont: 'Text, SemiBold',
    size: 18,
    lineHeight: 24,
    weight: 600,
    resource: 'BodyLargeStrongTextBlockStyle',
  },
  {
    name: 'Subtitle',
    variableFont: 'Display, SemiBold',
    size: 20,
    lineHeight: 28,
    weight: 600,
    resource: 'SubtitleTextBlockStyle',
  },
  {
    name: 'Title',
    variableFont: 'Display, SemiBold',
    size: 28,
    lineHeight: 36,
    weight: 600,
    resource: 'TitleTextBlockStyle',
  },
  {
    name: 'Title Large',
    variableFont: 'Display, SemiBold',
    size: 40,
    lineHeight: 52,
    weight: 600,
    resource: 'TitleLargeTextBlockStyle',
  },
  {
    name: 'Display',
    variableFont: 'Display, SemiBold',
    size: 68,
    lineHeight: 92,
    weight: 600,
    resource: 'DisplayTextBlockStyle',
  },
]

const tableWidths = [272, 160, 140, 230] as const

export function TypographyPage(context: AppContext) {
  const selectedRole = signal('Select a marker to inspect a type role.')
  const titleText: RefObject<TextBlock> = { current: null }
  const nativeStatus = signal('Native title font size: not measured')
  const variableFont = createFontFamily(
    FontFamily,
    'Segoe UI Variable',
  )
  const selectRole = (role: string) => {
    selectedRole.value = role
    nativeStatus.value =
      `Native title font size: ${Math.round(titleText.current?.fontSize ?? -1)}`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Typography"
      subtitle="Typography design guides attention with intuitive fonts and hierarchy."
      automationId="TypographyPageHeading"
      pageId="typography"
      model={context.model}
    >
      <GuidanceText text="Typography gives UI structure and hierarchy. Segoe UI Variable is the default Windows font: use Regular for most text and SemiBold for titles." />
      <GuidanceText text="Minimum guidance is 12px Regular for supporting text and 14px SemiBold where emphasis is required." />

      <SampleCard
        automationId="GalleryDesignTypographySample"
        title="Windows type ramp"
        description="The original guidance illustration and table map each role to its variable-font optical size, weight, size, line height, and WinUI resource."
        code={`
<UI.TextBlock
  fontFamily={segoeVariable}
  fontSize={28}
  lineHeight={36}
  fontWeight={{ weight: 600 }}
  text="Title"
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignTypographyStatus"
              text={selectedRole}
            />
            <UI.TextBlock
              automationId="GalleryDesignTypographyNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={24}>
          <UI.ScrollViewer
            horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
            horizontalScrollMode={ScrollMode.Auto}
          >
            <UI.Canvas width={750} height={450}>
              <DesignThemeImage
                lightPath="Design/Typography.light.png"
                darkPath="Design/Typography.dark.png"
                isDark={context.model.darkTheme}
                automationName="Windows typography hierarchy"
                width={750}
                height={450}
              />
              {[
                ['Caption', 650, 60],
                ['Body', 190, 280],
                ['Body Strong', 83, 245],
                ['Title', 320, 20],
                ['Display', 160, 110],
              ].map(([role, left, top]) => (
                <UI.Button
                  key={String(role)}
                  automationId={`GalleryDesignTypography${String(role).replaceAll(' ', '')}`}
                  automationName={`Show ${String(role)} typography guidance`}
                  canvasLeft={Number(left)}
                  canvasTop={Number(top)}
                  padding={thickness(4)}
                  toolTip={String(role)}
                  onClick={() => selectRole(String(role))}
                >
                  <UI.FontIcon glyph={'\uE946'} fontSize={16} />
                </UI.Button>
              ))}
            </UI.Canvas>
          </UI.ScrollViewer>

          <DesignTableScroller minWidth={880}>
            <DesignTableHeader
              columns={['Example', 'Variable Font', 'Size / Line height', 'Style']}
              widths={tableWidths}
            />
            {typeRamp.map((entry, index) => (
              <DesignTableRow
                key={entry.name}
                alternate={index % 2 === 1}
                automationId={`GalleryDesignTypographyRow${entry.name.replaceAll(' ', '')}`}
                widths={tableWidths}
                columns={[
                  <UI.TextBlock
                    {...(entry.name === 'Title'
                      ? { ref: titleText }
                      : {})}
                    fontFamily={variableFont}
                    fontSize={entry.size}
                    lineHeight={entry.lineHeight}
                    fontWeight={{ weight: entry.weight }}
                    text={entry.name}
                    textWrapping={TextWrapping.Wrap}
                    onLoaded={() => {
                      if (entry.name === 'Title') {
                        nativeStatus.value =
                          `Native title font size: ${Math.round(titleText.current?.fontSize ?? -1)}`
                      }
                    }}
                  />,
                  <UI.TextBlock text={entry.variableFont} />,
                  <UI.TextBlock
                    text={`${entry.size}/${entry.lineHeight} epx`}
                  />,
                  <UI.TextBlock
                    fontFamily={variableFont}
                    text={entry.resource}
                    textWrapping={TextWrapping.Wrap}
                  />,
                ]}
              />
            ))}
          </DesignTableScroller>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
