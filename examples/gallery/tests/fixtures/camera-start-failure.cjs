'use strict'

// Only preloaded by the camera-navigation smoke. Never request a real device.
if (!require('node:worker_threads').isMainThread) {
  const { MediaFrameSourceGroup } = require('#winapp/bindings')
  MediaFrameSourceGroup.findAllAsync = async () => {
    throw new Error('Camera startup probe: 0x8001010E')
  }
  console.log('Camera startup failure probe armed.')
}
