import {
  onCleanup,
  signal,
  thickness,
  type RefObject,
  type TeachingTipController,
} from 'dynwinrt-jsx'
import {
  Image,
  Stretch,
  Symbol,
  SymbolIconSource,
  TeachingTipPlacementMode,
  TextBlock,
  TextWrapping,
} from '#winapp/bindings'
import { createTeachingTip } from 'dynwinrt-jsx'
import {
  type AppContext,
  type ButtonInstance,
  LayoutGrid,
  type TeachingTipInstance,
  UI,
} from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'

function textContent(value: string): TextBlock {
  const text = new TextBlock()
  text.text = value
  return text
}

export function TeachingTipPage(context: AppContext) {
  const targetedButton: RefObject<ButtonInstance> = {
    current: null,
  }
  const heroButton: RefObject<ButtonInstance> = {
    current: null,
  }
  const targetedTip: RefObject<TeachingTipInstance> = {
    current: null,
  }
  const nonTargetedTip: RefObject<TeachingTipInstance> = {
    current: null,
  }
  const heroTip: RefObject<TeachingTipInstance> = {
    current: null,
  }
  const targetedStatus = signal('Targeted tip is closed.')
  const nonTargetedStatus = signal('Non-targeted tip is closed.')
  const heroStatus = signal('Hero tip is closed.')
  let targetedController:
    TeachingTipController<TeachingTipInstance> | null = null
  let nonTargetedController:
    TeachingTipController<TeachingTipInstance> | null = null
  let heroController:
    TeachingTipController<TeachingTipInstance> | null = null
  const refreshIcon = new SymbolIconSource()
  refreshIcon.symbol = Symbol.Refresh
  const actionContent = textContent('Action button')
  const closeContent = textContent('Close button')
  const heroImage = new Image()
  heroImage.source = loadGalleryBitmap(
    'SampleMedia/sunset.jpg',
    640,
  )
  heroImage.height = 180
  heroImage.stretch = Stretch.UniformToFill

  onCleanup(() => {
    targetedController?.dispose()
    nonTargetedController?.dispose()
    heroController?.dispose()
  })

  const ensureTargetedController = () => {
    const target = targetedButton.current
    const tip = targetedTip.current
    if (!target || !tip) {
      return null
    }
    if (!targetedController) {
      targetedController = createTeachingTip(
        context.renderer,
        tip,
        {
          target,
          xamlRoot: context.window.content.xamlRoot,
          onClosed: () => {
            targetedStatus.value = 'Targeted tip is closed.'
          },
        },
      )
    }
    return targetedController
  }

  const ensureNonTargetedController = () => {
    const tip = nonTargetedTip.current
    if (!tip) {
      return null
    }
    if (!nonTargetedController) {
      nonTargetedController = createTeachingTip(
        context.renderer,
        tip,
        {
          xamlRoot: context.window.content.xamlRoot,
          onClosed: () => {
            nonTargetedStatus.value =
              'Non-targeted tip is closed.'
          },
        },
      )
    }
    return nonTargetedController
  }

  const ensureHeroController = () => {
    const target = heroButton.current
    const tip = heroTip.current
    if (!target || !tip) {
      return null
    }
    if (!heroController) {
      heroController = createTeachingTip(
        context.renderer,
        tip,
        {
          target,
          xamlRoot: context.window.content.xamlRoot,
          onClosed: () => {
            heroStatus.value = 'Hero tip is closed.'
          },
        },
      )
    }
    return heroController
  }

  return (
    <Page
      title="TeachingTip"
      subtitle="Contextual guidance that can target controls or float independently."
      automationId="TeachingTipPageHeading"
      pageId="teaching-tip"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDialogsTeachingTipTargetedSample"
        title="A targeted TeachingTip"
        description="Anchor guidance and an icon to a specific feature."
        code={`
const tip = new TeachingTip()
tip.title = "This is the title"
tip.subtitle = "And this is the subtitle"
const controller = createTeachingTip(renderer, tip, {
  target,
  xamlRoot: window.content.xamlRoot,
})
controller.open(<GuidanceContent />)
        `}
        output={<UI.TextBlock text={targetedStatus} />}
      >
        <LayoutGrid>
          <UI.Button
            ref={targetedButton}
            automationId="GalleryTeachingTipTargetedShow"
            onClick={() => {
              const controller = ensureTargetedController()
              if (!controller) {
                return
              }
              if (controller.isOpen) {
                controller.close()
              }
              else {
                targetedStatus.value = 'Targeted tip is open.'
                controller.open(
                  <UI.TextBlock
                    text="Select Refresh to try the feature."
                  />,
                )
                context.model.recordInteraction()
              }
            }}
          >
            Show TeachingTip
          </UI.Button>
          <UI.TeachingTip
            ref={targetedTip}
            title="This is the title"
            subtitle="And this is the subtitle"
            iconSource={refreshIcon}
          />
        </LayoutGrid>
      </SampleCard>
      <SampleCard
        automationId="GalleryDialogsTeachingTipNonTargetedSample"
        title="A non-targeted TeachingTip"
        description="Show actionable guidance without pointing at a target."
        code={`
tip.actionButtonContent = actionContent
tip.closeButtonContent = closeContent
tip.isLightDismissEnabled = true
tip.placementMargin = thickness(20)
tip.preferredPlacement = TeachingTipPlacementMode.Auto
        `}
        output={<UI.TextBlock text={nonTargetedStatus} />}
      >
        <LayoutGrid>
          <UI.Button
            automationId="GalleryTeachingTipNonTargetedShow"
            onClick={() => {
              const controller = ensureNonTargetedController()
              if (!controller) {
                return
              }
              if (controller.isOpen) {
                controller.close()
              }
              else {
                nonTargetedStatus.value =
                  'Non-targeted tip is open.'
                controller.open(
                  <UI.TextBlock
                    text="Use either action to continue."
                  />,
                )
                context.model.recordInteraction()
              }
            }}
          >
            Show TeachingTip
          </UI.Button>
          <UI.TeachingTip
            ref={nonTargetedTip}
            title="This is the title"
            subtitle="And this is the subtitle"
            actionButtonContent={actionContent}
            closeButtonContent={closeContent}
            isLightDismissEnabled
            placementMargin={thickness(20)}
            preferredPlacement={TeachingTipPlacementMode.Auto}
            onActionButtonClick={() => {
              nonTargetedStatus.value =
                'Action button selected.'
              nonTargetedController?.close()
            }}
            onCloseButtonClick={() => {
              nonTargetedStatus.value =
                'Close button selected.'
            }}
          />
        </LayoutGrid>
      </SampleCard>
      <SampleCard
        automationId="GalleryDialogsTeachingTipHeroSample"
        title="A targeted TeachingTip with hero content"
        description="Combine an image, title, subtitle, and descriptive content."
        code={`
tip.preferredPlacement = TeachingTipPlacementMode.Bottom
tip.heroContent = heroImage
controller.open(
  <UI.TextBlock text="Description can go here" />,
)
        `}
        output={<UI.TextBlock text={heroStatus} />}
      >
        <LayoutGrid>
          <UI.Button
            ref={heroButton}
            automationId="GalleryTeachingTipHeroShow"
            onClick={() => {
              const controller = ensureHeroController()
              if (!controller) {
                return
              }
              if (controller.isOpen) {
                controller.close()
              }
              else {
                heroStatus.value = 'Hero tip is open.'
                controller.open(
                  <UI.TextBlock
                    margin={thickness(0, 16, 0, 0)}
                    text="Description can go here"
                    textWrapping={TextWrapping.WrapWholeWords}
                  />,
                )
                context.model.recordInteraction()
              }
            }}
          >
            Show TeachingTip
          </UI.Button>
          <UI.TeachingTip
            ref={heroTip}
            title="This is the title"
            subtitle="And this is the subtitle"
            preferredPlacement={TeachingTipPlacementMode.Bottom}
            heroContent={heroImage}
          />
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
