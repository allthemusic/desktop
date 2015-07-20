#!/usr/bin/env babel-node

import childProcess from 'child_process'
import fs from 'fs'
import { http, https } from 'follow-redirects'
import fpcalc from '../lib/fpcalc'
import acoustId from 'acoustid'
import CoverArt from 'coverart'
import id3 from 'id3_reader'
import tmp from 'tmp'
import R from 'ramda'
import { Set } from 'immutable'
import { IPFSClient, DagObject, util as ipfsUtil } from 'atm-ipfs-api'
import Clubnet from 'clubnet'
import Badge from 'badge'

const ACOUSTID_APP_TOKEN = 'OomsDyzs'

var filterFilenames = R.filter(name => name.endsWith('.mp3'))

var filterTags = R.pick([
  'artist',
  'title',
  'album',
  'genre',
  'track_number',
  'year',
  'publisher',
])

class Track{
  constructor(path, tags, image) {
    this.path = path
    this.tags = tags
    this.image = image
    this.size = 0
    this.chromaprint = null
    this.duration = null
    this.acoustid_track_id = null
    this.ipfs_keys = {
      metadata: null,
      media: null,
      image: null,
    }
  }
}

function readMp3(filename) {
  return new Promise((resolve, reject) => {
    console.time('readMp3: ' + filename)
    id3.read(filename, (err, data) => {
      if (err) {
        reject(err)
        return
      }
      var image = data.attached_picture
      var tags = filterTags(data)
      resolve(new Track(filename, tags, image))
      console.timeEnd('readMp3: ' + filename)
    })
  })
}

function fingerprintFile(filename) {
  console.time('fingerprinting: ' + filename)
  return fpcalc(filename).then(r => {
    console.timeEnd('fingerprinting: ' + filename)
    return r
  })
}

function acoustidLookup(fingerprintResult) {
  var fp = fingerprintResult
  return new Promise(function (resolve, reject) {
    acoustId(fp.fingerprint, fp.duration, { key: ACOUSTID_APP_TOKEN }, function (err, result) {
      if (err) { reject(err) }
      resolve(result ? result[0] : null)
    })
  })
}

var sortBySources = R.sortBy(R.prop('sources'))
var flatMapAllReleaseGroups = R.compose(R.flatten, R.reject(R.isNil), R.pluck('releasegroups'))
var flatMapAllReleases = R.compose(R.flatten, R.reject(R.isNil), R.pluck('releases'))
var sortByDate = R.sortBy(R.path(['date', 'year']))

var coverart = new CoverArt({
  userAgent: 'my-awesome-app/0.0.1 ( http://my-awesome-app.com )'
})

var findFirstReleaseWithCoverart = R.reduce((prom, release) => {
  return prom.then(prevResult => {
    if (prevResult) { return prevResult } // shovel a valid response down the chain

    // console.log('CoverArt search for release', release.id)
    return new Promise((resolve, reject) => {
      coverart.release(release.id, (err, response) => {
        if (err && err.statusCode == 404) {
          // no art for this release, try the next one
          resolve(false)
        } else if (err) {
          console.error(err, err.stack)
          reject(err)
        } else {
          resolve({ release: release, response: response })
        }
      })
    })
  })
})

function getBestGuessCoverArt(acoustidResult) {
  if (!(acoustidResult && acoustidResult.recordings)) { throw(new Error('No art could be found')) }
  var recs = sortBySources(acoustidResult.recordings)
  var releasegroups = flatMapAllReleaseGroups(recs)
  var releases = sortByDate(flatMapAllReleases(releasegroups))

  return findFirstReleaseWithCoverart(Promise.resolve(false), releases)
    .then(result => {
      if (result) { return result }
      throw(new Error('No art could be found'))
    })
    .then(getFirstFrontImageFromCoverArt)
}

function getFirstFrontImageFromCoverArt(coverartResult) {
  var imageResult = R.find(R.propEq('front', true), coverartResult.response.images)
  if (!imageResult) { throw new Error('Could not find front image') }
  return imageResult.image // return just the URL
}

function getFileSize(filename) {
  return new Promise((resolve, reject) => {
    console.time('stat: ' + filename)
    fs.stat(filename, (err, stat) => {
      if (err) { return reject(err) }
      resolve(stat.size)
      console.timeEnd('stat: ' + filename)
    })
  })
}

function ipfsAddFile(filename) {
  return new Promise((resolve, reject) => {
    console.time('ipfsAddFile: ' + filename)
    var output = ''
    var proc = childProcess.spawn('ipfs', ['add', '--quiet', filename], { stdio: ['inherit', 'pipe', 'inherit'] })
    proc.stdout.on('data', data => output += data.toString())
    proc.on('close', code => {
      if (code === 0) {
        resolve(output.trim())
      } else {
        console.log('exited ' + code)
        reject()
      }
      console.timeEnd('ipfsAddFile: ' + filename)
    })
  })
}

function buildMetadataNode(track) {
  var metadata = R.merge(track.tags, {
    fingerprints: {
      chromaprint: track.chromaprint,
    },
    duration: track.duration,
  })
  console.log('metadata', track.filename, metadata)

  var obj = new DagObject({ data: JSON.stringify(metadata) })
  obj = obj.addLink('file', track.ipfs_keys.media, track.size)
  obj = obj.addLink('image', track.ipfs_keys.image)
  console.log('metadata node', JSON.stringify(obj.asJSONforAPI()))
  return ipfs.objectPut(obj)
}

function addOneFile(filename) {
  var addFileP = ipfsAddFile(filename)
  var readTagsP = readMp3(filename)
  var fileSizeP = getFileSize(filename)
  var fingerprintP = fingerprintFile(filename)
  var acoustidP = fingerprintP.then(acoustidLookup)
  var coverartP = acoustidP.then(getBestGuessCoverArt).then(downloadFileIntoIpfs)

  return Promise.all([readTagsP, addFileP, fileSizeP, fingerprintP, acoustidP, coverartP])
    .then(([track, mediaNodeHash, size, fpResult, acoustidTrack, coverartKey]) => {
      console.log(track.tags)
      // if (track.image) {
      //   console.log('WARN: Track has embedded image asset; ignoring for now')
      // }
      track.size = size
      track.ipfs_keys.media = mediaNodeHash
      track.ipfs_keys.image = coverartKey
      track.chromaprint = fpResult.fingerprint
      track.duration = parseInt(fpResult.duration)
      track.acoustid_track_id = acoustidTrack.id
      return track
    })
    .then(track => {
      console.log('ipfs_keys', track.ipfs_keys)
      return buildMetadataNode(track).then(hash => {
        // console.log('added metadata node', hash)
        track.ipfs_keys.metadata = hash
        return track
      })
    })
}

function addDirectoryTree(contents) {
  var addLink = (contentsNode, key) => contentsNode.addLink(key, key)
  var contentsNode = R.reduce(addLink, new DagObject(), contents)
  return ipfs.objectPut(contentsNode)
    .then(contentsNodeHash =>
          ipfs.objectPut(new DagObject().addLink('contents', contentsNodeHash)))
    .then(atmNodeHash =>
          ipfs.objectPut(new DagObject().addLink('allthemusic', atmNodeHash)))
}

function getCurrentContents() {
  return ipfs.nameResolveSelf()
    .then(publishedKey => ipfs.objectGet(publishedKey + '/allthemusic/contents'))
    .then(contentsNode => R.pluck('Hash', contentsNode.Links))
    .catch(err => {
      console.error('Failed to resolve current published contents')
      console.error(err.stack)
      return []
    })
}

function downloadFileIntoIpfs(url) {
  if (!url) { return false }
  var tmpfile = tmp.fileSync()
  return new Promise((resolve, reject) => {
    console.log('downloading', url, 'to', tmpfile.name)
    var file = fs.createWriteStream(null, { fd: tmpfile.fd });
    var adapter = url.startsWith('https') ? https : http
    adapter.get(url, (response) => {
      if (response.statusCode != 200) {
        reject(new Error('non-200 response:' + response.statusCode + '\n' + response.body))
      }
      response.pipe(file)
      file.on('finish', () => { file.close(resolve) })
      file.on('error', reject)
    })
  }).then(() => ipfsAddFile(tmpfile.name))
}

var ipfs = new IPFSClient(ipfsUtil.ipfsEndpoint())
var clubnet = new Clubnet(ipfs, () => new Badge())

var filenames = filterFilenames(process.argv.slice(2))
if (filenames.length === 0) {
  console.error('ERROR: Supply one or more *.mp3 filename arguments')
  process.exit(1)
}
// console.log('filenames =', filenames)

var trackKeys = []
var errors = []
R.reduce(
  (prom, filename) => prom.then(() => {
    return addOneFile(filename)
      .then(key => trackKeys = trackKeys.concat(key))
      .catch(err => {
        errors = errors.concat({ filename, err });
      })
  }),
  Promise.resolve(),
  filenames
)
  .then(() => {
    var tracks = R.reject(R.isNil, trackKeys)
    if (tracks.length === 0) { return }
    var newTrackKeys = R.map(R.path(['ipfs_keys', 'metadata']), tracks)
    console.log(newTrackKeys)

    console.log('Republishing...')
    console.time('republishing')
    return clubnet.wearBadge()
      .then(getCurrentContents)
      .then(contents => {
        var newContents = new Set(contents).union(newTrackKeys).toJS()
        return addDirectoryTree(newContents)
      })
      .then(newKey => ipfs.namePublish(newKey))
      .then(() => console.timeEnd('republishing'))
      .catch(e => {
        console.error('ERROR', e.stack)
      })
  })
  .catch(e => {
    console.error('ERROR', e.stack)
  }).then(() => {
    if (errors.length > 0) {
      console.log('Files with errors: (%d failed of %d files)', errors.length, filenames.length)
      errors.forEach(({ filename, err }) => {
        console.log(filename)
        console.log(err.stack)
      })
    }
  })
