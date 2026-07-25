import {
  color,
  computed,
  createSolidColorBrush,
  effect,
  onCleanup,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Border,
  BrushTransition,
  ElementTheme,
  Grid,
  HorizontalAlignment,
  Rectangle,
  ScalarTransition,
  SolidColorBrush,
  TextWrapping,
  Vector3Transition,
  Vector3TransitionComponents,
} from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
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

export function ImplicitTransitionsPage(context: AppContext) {
  const motion = useMotionSettings()
  const opacityValue = signal(0.5)
  const rotationValue = signal(45)
  const scaleValue = signal(1)
  const translationValue = signal(1)
  const scaleComponents = [
    signal(true),
    signal(true),
    signal(true),
  ] as const
  const translationComponents = [
    signal(true),
    signal(true),
    signal(true),
  ] as const
  const themeIsDark = signal(false)
  const backgroundIsYellow = signal(false)
  const transitionResult = signal(
    'Background transition applied: blue.',
  )
  const blueBrush = createSolidColorBrush(
    SolidColorBrush,
    color(0, 120, 212),
  )
  const yellowBrush = createSolidColorBrush(
    SolidColorBrush,
    color(255, 185, 0),
  )

  const opacityRectangle: RefObject<Rectangle> = { current: null }
  const rotationRectangle: RefObject<Rectangle> = { current: null }
  const scaleRectangle: RefObject<Rectangle> = { current: null }
  const translationRectangle: RefObject<Rectangle> = { current: null }
  const brushPresenter: RefObject<Border> = { current: null }
  const themeGrid: RefObject<Grid> = { current: null }

  const opacityTransition = new ScalarTransition()
  const rotationTransition = new ScalarTransition()
  const scaleTransition = new Vector3Transition()
  const translationTransition = new Vector3Transition()
  const brushTransition = new BrushTransition()
  const themeTransition = new BrushTransition()

  const setNullableTransition = <
    TTarget extends object,
    TKey extends keyof TTarget,
  >(
    target: TTarget,
    key: TKey,
    value: TTarget[TKey] | null,
  ) => {
    if (!Reflect.set(target, key, value)) {
      throw new Error(`Could not set ${String(key)}.`)
    }
  }
  const applyTransitions = () => {
    const enabled = motion.enabled.value
    if (opacityRectangle.current) {
      setNullableTransition(
        opacityRectangle.current,
        'opacityTransition',
        enabled ? opacityTransition : null,
      )
    }
    if (rotationRectangle.current) {
      setNullableTransition(
        rotationRectangle.current,
        'rotationTransition',
        enabled ? rotationTransition : null,
      )
    }
    if (scaleRectangle.current) {
      setNullableTransition(
        scaleRectangle.current,
        'scaleTransition',
        enabled ? scaleTransition : null,
      )
    }
    if (translationRectangle.current) {
      setNullableTransition(
        translationRectangle.current,
        'translationTransition',
        enabled ? translationTransition : null,
      )
    }
    if (brushPresenter.current) {
      setNullableTransition(
        brushPresenter.current,
        'backgroundTransition',
        enabled ? brushTransition : null,
      )
    }
    if (themeGrid.current) {
      setNullableTransition(
        themeGrid.current,
        'backgroundTransition',
        enabled ? themeTransition : null,
      )
    }
  }

  const selectedComponents = (
    components: readonly { readonly value: boolean }[],
  ): Vector3TransitionComponents =>
    ((components[0]!.value
      ? Vector3TransitionComponents.X
      : 0) |
    (components[1]!.value
      ? Vector3TransitionComponents.Y
      : 0) |
    (components[2]!.value
      ? Vector3TransitionComponents.Z
      : 0)) as Vector3TransitionComponents

  effect(() => {
    motion.enabled.value
    applyTransitions()
  })

  const setChecked = (
    target: { value: boolean },
    value: boolean,
  ) => {
    target.value = value
  }
  const numberValue = (numberBox: NumberBoxInstance) =>
    Number.isNaN(numberBox.value) ? 0 : numberBox.value

  onCleanup(() => {
    let firstError: unknown
    const attempt = (action: () => void) => {
      try {
        action()
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    const opacityTarget = opacityRectangle.current
    if (opacityTarget) {
      attempt(() =>
        setNullableTransition(
          opacityTarget,
          'opacityTransition',
          null,
        ))
    }
    const rotationTarget = rotationRectangle.current
    if (rotationTarget) {
      attempt(() =>
        setNullableTransition(
          rotationTarget,
          'rotationTransition',
          null,
        ))
    }
    const scaleTarget = scaleRectangle.current
    if (scaleTarget) {
      attempt(() =>
        setNullableTransition(
          scaleTarget,
          'scaleTransition',
          null,
        ))
    }
    const translationTarget = translationRectangle.current
    if (translationTarget) {
      attempt(() =>
        setNullableTransition(
          translationTarget,
          'translationTransition',
          null,
        ))
    }
    const brushTarget = brushPresenter.current
    if (brushTarget) {
      attempt(() =>
        setNullableTransition(
          brushTarget,
          'backgroundTransition',
          null,
        ))
    }
    const themeTarget = themeGrid.current
    if (themeTarget) {
      attempt(() =>
        setNullableTransition(
          themeTarget,
          'backgroundTransition',
          null,
        ))
    }
    attempt(() =>
      releaseMotionResources([
        opacityTransition,
        rotationTransition,
        scaleTransition,
        translationTransition,
        brushTransition,
        themeTransition,
        blueBrush,
        yellowBrush,
      ]))
    if (firstError !== undefined) {
      throw firstError
    }
  })

  return (
    <Page
      title="Implicit Transitions"
      subtitle="Use Implicit Transitions to automatically animate changes to properties."
      automationId="ImplicitTransitionsPageHeading"
      pageId="implicit-transitions"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionImplicitTransitionsStatus"
        settings={motion}
      />
      <SampleCard
        title="Automatically animate changes to Opacity"
        description="ScalarTransition animates a new Opacity value without creating or starting a storyboard."
        code={`rectangle.opacityTransition = new ScalarTransition()
rectangle.opacity = ${opacityValue.value}`}
        options={
          <UI.StackPanel spacing={8}>
            <UI.NumberBox
              header="Opacity (0.0 to 1.0)"
              minimum={0}
              maximum={1}
              value={opacityValue}
              onValueChanged={(sender) => {
                opacityValue.value = numberValue(sender)
              }}
            />
            <UI.Button
              onClick={() => {
                if (opacityRectangle.current) {
                  opacityRectangle.current.opacity =
                    opacityValue.value
                }
                context.model.recordInteraction()
              }}
            >
              Set Opacity
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Rectangle
          ref={(value) => {
            opacityRectangle.current = value
            applyTransitions()
          }}
          width={50}
          height={50}
          margin={thickness(45, 5, 5, 5)}
          fill={theme.accent}
          opacity={0.5}
        />
      </SampleCard>

      <SampleCard
        title="Automatically animate changes to Rotation"
        description="ScalarTransition rotates around CenterPoint when the Rotation property changes."
        code={`rectangle.rotationTransition = new ScalarTransition()
rectangle.centerPoint = {
  x: rectangle.actualWidth / 2,
  y: rectangle.actualHeight / 2,
  z: 0,
}
rectangle.rotation = ${rotationValue.value}`}
        options={
          <UI.StackPanel spacing={8}>
            <UI.NumberBox
              header="Rotation (0.0 to 360.0)"
              minimum={0}
              maximum={360}
              value={rotationValue}
              onValueChanged={(sender) => {
                rotationValue.value = numberValue(sender)
              }}
            />
            <UI.Button
              onClick={() => {
                const rectangle = rotationRectangle.current
                if (rectangle) {
                  rectangle.centerPoint = {
                    x: rectangle.actualWidth / 2,
                    y: rectangle.actualHeight / 2,
                    z: 0,
                  }
                  rectangle.rotation = rotationValue.value
                }
                context.model.recordInteraction()
              }}
            >
              Set Rotation
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Rectangle
          ref={(value) => {
            rotationRectangle.current = value
            applyTransitions()
          }}
          width={50}
          height={50}
          margin={thickness(45, 5, 5, 5)}
          fill={yellowBrush}
        />
      </SampleCard>

      <SampleCard
        title="Automatically animate changes to Scale"
        description="Vector3Transition can animate selected X, Y, and Z components."
        code={`transition.components =
  Vector3TransitionComponents.X |
  Vector3TransitionComponents.Y |
  Vector3TransitionComponents.Z
rectangle.scaleTransition = transition
rectangle.scale = { x: 2, y: 2, z: 2 }`}
        options={
          <UI.StackPanel spacing={8}>
            {[0.5, 1, 2].map((value) => (
              <UI.Button
                key={value}
                onClick={() => {
                  scaleValue.value = value
                  scaleTransition.components =
                    selectedComponents(scaleComponents)
                  if (scaleRectangle.current) {
                    scaleRectangle.current.scale = {
                      x: value,
                      y: value,
                      z: value,
                    }
                  }
                }}
              >
                {`Set Scale to (${value.toFixed(1)}, ${value.toFixed(1)}, ${value.toFixed(1)})`}
              </UI.Button>
            ))}
            <UI.TextBlock text="Components" />
            {['Animate X', 'Animate Y', 'Animate Z'].map(
              (label, index) => (
                <UI.CheckBox
                  key={label}
                  content={label}
                  isChecked={scaleComponents[index]!}
                  onChecked={() =>
                    setChecked(scaleComponents[index]!, true)}
                  onUnchecked={() =>
                    setChecked(scaleComponents[index]!, false)}
                />
              ),
            )}
            <UI.NumberBox
              header="Scale (0.0 to 5.0)"
              minimum={0}
              maximum={5}
              value={scaleValue}
              onValueChanged={(sender) => {
                scaleValue.value = numberValue(sender)
              }}
            />
            <UI.Button
              onClick={() => {
                scaleTransition.components =
                  selectedComponents(scaleComponents)
                if (scaleRectangle.current) {
                  const value = scaleValue.value
                  scaleRectangle.current.scale = {
                    x: value,
                    y: value,
                    z: value,
                  }
                }
              }}
            >
              Set custom scale
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Rectangle
          ref={(value) => {
            scaleRectangle.current = value
            applyTransitions()
          }}
          width={50}
          height={50}
          margin={thickness(45, 5, 5, 5)}
          fill={theme.accent}
        />
      </SampleCard>

      <SampleCard
        title="Automatically animate changes to Translation"
        description="Vector3Transition animates selected Translation components."
        code={`rectangle.translationTransition = transition
rectangle.translation = { x: 100, y: 100, z: 100 }`}
        options={
          <UI.StackPanel spacing={8}>
            {[0, 100, 200].map((value) => (
              <UI.Button
                key={value}
                onClick={() => {
                  translationValue.value = value
                  translationTransition.components =
                    selectedComponents(translationComponents)
                  if (translationRectangle.current) {
                    translationRectangle.current.translation = {
                      x: value,
                      y: value,
                      z: value,
                    }
                  }
                }}
              >
                {`Set Translation to (${value}, ${value}, ${value})`}
              </UI.Button>
            ))}
            <UI.TextBlock text="Components" />
            {['Animate X', 'Animate Y', 'Animate Z'].map(
              (label, index) => (
                <UI.CheckBox
                  key={label}
                  content={label}
                  isChecked={translationComponents[index]!}
                  onChecked={() =>
                    setChecked(
                      translationComponents[index]!,
                      true,
                    )}
                  onUnchecked={() =>
                    setChecked(
                      translationComponents[index]!,
                      false,
                    )}
                />
              ),
            )}
            <UI.NumberBox
              header="Translation (0.0 to 200.0)"
              minimum={0}
              maximum={200}
              value={translationValue}
              onValueChanged={(sender) => {
                translationValue.value = numberValue(sender)
              }}
            />
            <UI.Button
              onClick={() => {
                translationTransition.components =
                  selectedComponents(translationComponents)
                if (translationRectangle.current) {
                  const value = translationValue.value
                  translationRectangle.current.translation = {
                    x: value,
                    y: value,
                    z: value,
                  }
                }
              }}
            >
              Set custom Translation
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Rectangle
          ref={(value) => {
            translationRectangle.current = value
            applyTransitions()
          }}
          width={50}
          height={50}
          margin={thickness(45, 5, 5, 5)}
          fill={theme.accent}
        />
      </SampleCard>

      <SampleCard
        title="Implicitly animate when the Background changes"
        description="BrushTransition interpolates between SolidColorBrush values."
        code={`presenter.backgroundTransition = new BrushTransition()
presenter.background = nextBrush`}
        options={
          <UI.StackPanel spacing={8}>
            <UI.Button
              automationId="GalleryMotionImplicitTransitionsBackground"
              onClick={() => {
                backgroundIsYellow.value =
                  !backgroundIsYellow.value
                if (brushPresenter.current) {
                  brushPresenter.current.background =
                    backgroundIsYellow.value
                      ? yellowBrush
                      : blueBrush
                }
                transitionResult.value =
                  `Background transition applied: ${
                    backgroundIsYellow.value ? 'yellow' : 'blue'
                  }.`
                context.model.recordInteraction()
              }}
            >
              Change Background Color
            </UI.Button>
            <UI.TextBlock
              automationId="GalleryMotionImplicitTransitionsResult"
              text={transitionResult}
            />
          </UI.StackPanel>
        }
      >
        <UI.Border
          ref={(value) => {
            brushPresenter.current = value
            applyTransitions()
          }}
          width={50}
          height={50}
          margin={thickness(45, 5, 5, 5)}
          background={blueBrush}
        />
      </SampleCard>

      <SampleCard
        title="Implicitly animate when the Grid's theme changes"
        description="A BrushTransition animates the local Grid background while RequestedTheme changes."
        code={`grid.backgroundTransition = new BrushTransition()
grid.requestedTheme =
  grid.requestedTheme === ElementTheme.Dark
    ? ElementTheme.Light
    : ElementTheme.Dark`}
        options={
          <UI.Button
            onClick={() => {
              themeIsDark.value = !themeIsDark.value
              context.model.recordInteraction()
            }}
          >
            Change Theme
          </UI.Button>
        }
      >
        <UI.Grid
          ref={(value) => {
            themeGrid.current = value
            applyTransitions()
          }}
          width={300}
          minHeight={200}
          padding={thickness(12)}
          background={theme.solidBackground}
          borderBrush={theme.dividerStroke}
          borderThickness={thickness(1)}
          requestedTheme={computed(() =>
            themeIsDark.value
              ? ElementTheme.Dark
              : ElementTheme.Light)}
        >
          <UI.StackPanel spacing={6}>
            <UI.TextBlock text="Lorem Ipsum" />
            <UI.TextBlock
              text="The background of this grid animates when the theme changes."
              textWrapping={TextWrapping.WrapWholeWords}
            />
            <UI.Button content="Button" />
            <UI.CheckBox content="CheckBox" />
          </UI.StackPanel>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
