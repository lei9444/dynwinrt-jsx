'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createScrollViewerController,
  effect,
} = require('../dist')

class FakeScrollViewer {
  horizontalOffset = 0
  verticalOffset = 0
  scrollableWidth = 300
  scrollableHeight = 500
  viewportWidth = 100
  viewportHeight = 200
  viewChanged = new Set()
  sizeChanged = new Set()
  loaded = new Set()
  layoutUpdated = new Set()
  changeCalls = []

  onViewChanged(callback) {
    this.viewChanged.add(callback)
    return () => this.viewChanged.delete(callback)
  }

  onSizeChanged(callback) {
    this.sizeChanged.add(callback)
    return () => this.sizeChanged.delete(callback)
  }

  onLoaded(callback) {
    this.loaded.add(callback)
    return () => this.loaded.delete(callback)
  }

  onLayoutUpdated(callback) {
    this.layoutUpdated.add(callback)
    return () => this.layoutUpdated.delete(callback)
  }

  changeView(horizontal, vertical, zoom, disableAnimation) {
    this.changeCalls.push([
      horizontal,
      vertical,
      zoom,
      disableAnimation,
    ])
    if (horizontal !== null) {
      this.horizontalOffset = horizontal
    }
    if (vertical !== null) {
      this.verticalOffset = vertical
    }
    this.emit(this.viewChanged)
    return true
  }

  emit(listeners) {
    for (const listener of [...listeners]) {
      listener(this, {})
    }
  }
}

test('ScrollViewer controller tracks boundaries and viewport scrolling', () => {
  const controller = createScrollViewerController()
  const scrollViewer = new FakeScrollViewer()
  controller.current = scrollViewer

  assert.equal(controller.horizontalOffset.value, 0)
  assert.equal(controller.canScrollBackward.value, false)
  assert.equal(controller.canScrollForward.value, true)
  assert.equal(controller.canScrollUp.value, false)
  assert.equal(controller.canScrollDown.value, true)
  assert.equal(scrollViewer.viewChanged.size, 1)
  assert.equal(scrollViewer.sizeChanged.size, 1)
  assert.equal(scrollViewer.loaded.size, 1)
  assert.equal(scrollViewer.layoutUpdated.size, 1)

  assert.equal(
    controller.scrollHorizontalByViewport(1, true),
    true,
  )
  assert.deepEqual(scrollViewer.changeCalls.at(-1), [
    100,
    null,
    null,
    true,
  ])
  assert.equal(controller.horizontalOffset.value, 100)
  assert.equal(controller.canScrollBackward.value, true)

  controller.scrollHorizontalByViewport(1)
  controller.scrollHorizontalByViewport(1)
  controller.scrollHorizontalByViewport(1)
  assert.equal(controller.horizontalOffset.value, 300)
  assert.equal(controller.canScrollForward.value, false)

  controller.scrollVerticalByViewport(1)
  assert.equal(controller.verticalOffset.value, 200)
  controller.scrollToVerticalOffset(900, true)
  assert.equal(controller.verticalOffset.value, 500)
  assert.equal(controller.canScrollDown.value, false)

  scrollViewer.scrollableWidth = 0
  scrollViewer.horizontalOffset = 0
  const boundaries = []
  const stop = effect(() => {
    boundaries.push(controller.canScrollForward.value)
  })
  scrollViewer.emit(scrollViewer.layoutUpdated)
  assert.equal(controller.scrollableWidth.value, 0)
  assert.equal(controller.canScrollForward.value, false)
  assert.equal(boundaries.includes(true), false)
  assert.equal(boundaries.at(-1), false)
  stop()

  controller.current = null
  assert.equal(scrollViewer.viewChanged.size, 0)
  assert.equal(scrollViewer.sizeChanged.size, 0)
  assert.equal(scrollViewer.loaded.size, 0)
  assert.equal(scrollViewer.layoutUpdated.size, 0)
  assert.equal(controller.scrollHorizontalByViewport(1), false)
})

test('ScrollViewer controller detachment and disposal are retryable', () => {
  const controller = createScrollViewerController()
  const scrollViewer = new FakeScrollViewer()
  let attempts = 0
  scrollViewer.onViewChanged = (callback) => {
    scrollViewer.viewChanged.add(callback)
    return () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('unsubscribe failed')
      }
      scrollViewer.viewChanged.delete(callback)
    }
  }
  controller.current = scrollViewer

  assert.throws(
    () => {
      controller.current = null
    },
    /unsubscribe failed/,
  )
  assert.equal(controller.current, scrollViewer)
  controller.current = null
  assert.equal(controller.current, null)

  controller.current = scrollViewer
  controller.dispose()
  assert.equal(controller.disposed, true)
  assert.throws(
    () => {
      controller.current = scrollViewer
    },
    /disposed ScrollViewer controller/,
  )
})

test('ScrollViewer controller rolls back partial attachment failures', () => {
  const controller = createScrollViewerController()
  const scrollViewer = new FakeScrollViewer()
  scrollViewer.onSizeChanged = () => {
    throw new Error('size subscription failed')
  }

  assert.throws(
    () => {
      controller.current = scrollViewer
    },
    /size subscription failed/,
  )
  assert.equal(controller.current, null)
  assert.equal(scrollViewer.viewChanged.size, 0)
})
