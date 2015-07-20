import url from 'url'
import concat from 'concat-stream'

export function ipfsEndpoint(fallback) {
  if (process.env.ipfs_endpoint) {
    return url.parse(process.env.ipfs_endpoint)
  } else if (process.env.npm_package_config_ipfs_endpoint) {
    // configured endpoint default in package.json
    return url.parse(process.env.npm_package_config_ipfs_endpoint)
  } else if (global.ipfs_endpoint) {
    return url.parse(global.ipfs_endpoint)
  } else if (fallback) {
    return url.parse(fallback)
  } else {
    throw new Error('Could not determine IPFS endpoint')
  }
}

export function p(...values) {
  console.log(...values)
  return values[0]
}

export function pl(label) {
  return function (...values) {
    console.log(label, ...values)
    return values[0]
  }
}

// usually given to a #then() method on a Promise which returns a stream;
// returns a new Promise which will resolve to a concatenation of the stream
// into an array.
export function concatP(stream) {
  return new Promise(function (resolve, reject) {
    stream.on('error', reject)
    stream.pipe(concat({ encoding: 'object' }, resolve))
  })
}

export function concatRawP(stream) {
  return new Promise(function (resolve, reject) {
    stream.on('error', reject)
    stream.pipe(concat({}, resolve))
  })
}
