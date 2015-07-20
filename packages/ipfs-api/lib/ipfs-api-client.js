import url from 'url'
import util from 'util'
import http from 'http'
import R from 'ramda'
import concat from 'concat-stream'
import through from 'through2'
import postForm from './http-post-form'
import DagObject from './dag-object'
import { concatP } from './util'
import parseJSONResponse from './parse-json-response'
import Version from './version'

var debuglog = util.debuglog('ipfs-api')

export const minimumIPFSVersion = new Version(0, 3, 3)

const dhtResponseTypes = {
  QueryEventType: 0,
  SendingQuery: 0,
  PeerResponse: 1,
  FinalPeer: 2,
  QueryError: 3,
  Provider: 4,
  Value: 5,
}

function processJSONResponse(response) {
  if (responseIsJSON(response.contentType)) {
    try {
      return JSON.parse(response.body)
    } catch (e) {
      console.error('response.body =', response.body.toString())
      var error = new Error('Response is application/json but cannot be parsed.')
      error.original_error = e
      error.response_body = response.body
      throw(error)
    }
  } else {
    return response.body
  }
}

function responseIsJSON(contentType) {
  return contentType == 'application/json'
}

function ipfsRequest(method, requestURL, options) {
  if (options && options.files) {
    return postForm(requestURL, options.files).then(processJSONResponse)
  }

  return new Promise(function (resolve, reject) {
    var request = http.request({
      hostname: requestURL.hostname,
      port: requestURL.port,
      path: requestURL.path,
      method: method,
    })

    request.on('response', function (_response) {
      var response = _response
      if (responseIsJSON(_response.headers['content-type'])) {
        response = response.pipe(parseJSONResponse())
      }
      if (_response.statusCode == 200) {
        resolve(response)
      } else {
        response.pipe(concat((body) => {
          var e = new Error(util.format('[IPFS %s %s]: status = %s, body = %s',
                                        method, requestURL.path, response.statusCode, JSON.stringify(body)))
          reject(e)
        }))
      }
    })

    request.on('error', reject)
    request.end()
  })
}

var appendUrl = R.compose(url.parse, url.resolve)

export default class IPFSClient {
  constructor(ipfsEndpoint) {
    // always use the V0 api path prefix for now
    this.ipfsEndpoint = appendUrl(ipfsEndpoint, '/api/v0/')
    debuglog('ipfsEndpoint =>', ipfsEndpoint.href)
  }

  requestURL(path) {
    return appendUrl(this.ipfsEndpoint, path)
  }

  version() {
    debuglog('version()')
    return ipfsRequest('GET', this.requestURL('version'))
      .then(concatP)
      .then(R.compose(Version.parseString, R.prop('Version'), R.last))
  }

  assertVersionCompatible() {
    return this.version()
      .then(version => new Promise((resolve, reject) => {
        if (version.gte(minimumIPFSVersion)) {
          resolve(version)
        } else {
          reject(new Error(`need version ${minimumIPFSVersion} but connected to ${version}`))
        }
      })
    )
  }

  peerID() {
    debuglog('peerID()')
    return ipfsRequest('GET', this.requestURL('id'))
      .then(concatP)
      .then(R.compose(R.prop('ID'), R.last))
  }

  nameResolve(peerId) {
    debuglog('nameResolve(%s)', peerId)

    var args = ''
    if (peerId) {
      args = '?arg=' + peerId
    }

    return ipfsRequest('GET', this.requestURL('name/resolve' + args))
      .then(concatP)
      .then(R.compose(R.prop('Path'), R.last))
  }

  namePublish(value) {
    debuglog('namePublish(%s)', value)
    return ipfsRequest('GET', this.requestURL('name/publish?arg=' + value))
      .then(concatP)
      .then(R.last)
  }

  objectPut(dagNode) {
    var json = JSON.stringify(dagNode.asJSONforAPI())
    debuglog('objectPut()', json)

    var opts = {
      files: [{
        name: 'data',
        file: new Buffer(json),
      }]
    }

    return ipfsRequest('POST', this.requestURL('object/put?arg=json'), opts)
      .then(R.compose(R.prop('Hash')))
  }

  objectGet(key) {
    debuglog('objectGet()', key)
    return ipfsRequest('GET', this.requestURL('object/get?arg=' + key))
      .then(concatP)
      .then(R.last)
      .then(rawObj => DagObject.fromAPI(rawObj))
  }

  dhtFindprovs(contentID) {
    debuglog('dhtFindprovs()', contentID)

    var transform = (response) => {
      return response.pipe(through.obj(function (chunk, enc, cb) {
        if (chunk.Type == dhtResponseTypes.Provider) {
          chunk.Responses.forEach(res => this.push(res))
        }
        cb()
      }))
    }

    return ipfsRequest('GET', this.requestURL('dht/findprovs/' + contentID))
      .then(transform)
  }

  nameResolveSelf() {
    return this.nameResolve(null)
  }

  pinAdd(key) {
    debuglog('pinAdd()', key)
    return ipfsRequest('GET', this.requestURL('pin/add?arg=' + key))
      .then(concatP)
      .then(R.compose(R.prop('Pinned'), R.last))
  }

  cat(key) {
    debuglog('cat()', key)
    return ipfsRequest('GET', this.requestURL('cat?arg=' + key))
  }

  get(key) {
    debuglog('get()', key)
    return ipfsRequest('GET', this.requestURL('get?arg=' + key))
  }

  add(contents) {
    debuglog('add()', contents)

    var opts = {
      files: [{
        name: 'data',
        file: new Buffer(contents),
      }]
    }

    return ipfsRequest('POST', this.requestURL('add'), opts)
      .then(obj => obj.Hash)
  }
}
