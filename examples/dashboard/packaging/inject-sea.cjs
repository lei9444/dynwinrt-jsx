'use strict'

const fs = require('node:fs')
const path = require('node:path')

const [executable, blob, postjectApi] = process.argv.slice(2)
if (!executable || !blob || !postjectApi) {
  throw new Error('Expected executable, blob, and postject API paths.')
}

const { inject } = require(path.resolve(postjectApi))

inject(
  path.resolve(executable),
  'NODE_SEA_BLOB',
  fs.readFileSync(path.resolve(blob)),
  {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  },
).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
