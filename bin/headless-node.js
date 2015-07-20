#!/usr/bin/env babel-node

import { Set } from 'immutable'
import R from 'ramda'
import devNull from 'dev-null'
import { IPFSClient, DagObject, util as ipfsUtil } from 'atm-ipfs-api'
import Clubnet from 'clubnet'
import Badge from 'badge'
import decorateHash from 'hash-decorator'

var ipfs = new IPFSClient(ipfsUtil.ipfsEndpoint())
var clubnet = new Clubnet(ipfs, () => new Badge())

var fetchedKeys = new Set()
var tracks = new Set()
var myPeerID

const second = 1000
const minute = 60 * second

function decoratePeerID(peerID) {
  var dPeerID = decorateHash(peerID)
  return '[' + (peerID === myPeerID ? `${dPeerID} (local node)` : dPeerID) + ']'
}

function publish(key) {
  console.log('publishing:', key)
  console.time('publish: ' + key)
  return ipfs.namePublish(key)
    .then(() => console.timeEnd('publish: ' + key))
    .catch(handleError('publish'))
}

// function wearBadge() {
//   return clubnet.wearBadge().then(key => {
//     console.log('badge key =', key._hash)
//     return key
//   }).catch(handleError('wearBadge'))
// }

function handleError(scope) {
  return function (err) {
    if (!err) { return }
    console.log('ERROR [%s]', scope)
    if (err instanceof Error) {
      console.log(err.stack)
    } else {
      console.log(err)
    }
  }
}

function getPeers() {
  return clubnet.findPeers().catch(handleError('getPeers'))
}

var filesCompletedPrefetch = []
var filesToPrefetch = []

function preFetchFiles() {
  if (filesToPrefetch.length > 0) {
    console.log('files to prefetch', filesToPrefetch.length)
    var path = filesToPrefetch.pop()
    var logPrefix = `[preFetchFile ${path}]`
    return ipfs.cat(path)
      .then(stream => {
        return stream
          .on('error', handleError(logPrefix + '[stream-error]'))
          .on('end', () => console.log(logPrefix, 'success'))
          .pipe(devNull())
      })
      .catch(handleError(logPrefix))
  }
}

function preFetchFile(path) {
  if (filesCompletedPrefetch.indexOf(path) < 0) {
    filesToPrefetch.push(path)
    filesCompletedPrefetch.push(path)
  }
}

function fetchContent(thisPeersContents) {
  var contents = new Set().union(R.pluck('Hash', thisPeersContents.Links))
  contents = contents.subtract(fetchedKeys)

  contents.forEach(id => {
    ipfs.objectGet(id)
      .then(object => {
        fetchedKeys = fetchedKeys.add(id)
        var metadata = JSON.parse(object.Data)
        // metadata.id = id
        // console.log('new track [%s]: %s - %s', id, metadata.artist, metadata.title)
        tracks = tracks.add(id)

        preFetchFile(id + '/file')
        preFetchFile(id + '/image')
      })
      .catch(handleError('objectGet ' + id))
  })
}

function addDirectoryTree(contents, peerlist) {
  var addLink = (contentsNode, key) => contentsNode.addLink(key, key)
  var contentsNode = R.reduce(addLink, new DagObject(), contents)
  var peerlistNode = R.reduce(addLink, new DagObject(), peerlist)

  return Promise.all([
    ipfs.objectPut(contentsNode),
    ipfs.objectPut(peerlistNode),
  ])
    .then(([contentsNodeHash, peerlistNodeHash]) => {
      var obj = new DagObject()
        .addLink('contents', contentsNodeHash)
        .addLink('peers', peerlistNodeHash)
      return ipfs.objectPut(obj)
    })
    .then(atmNodeHash =>
          ipfs.objectPut(new DagObject().addLink('allthemusic', atmNodeHash)))
}

function publishLoop() {
  console.log('Current stats: contents=%d tracks ; peerlist=%d peers', tracks.size, clubnet.peerlist.size)
  return addDirectoryTree(tracks.toJS(), clubnet.peerlist.toJS())
    .then(publish)
    .catch(handleError('publishing'))
    .then(() => setTimeout(publishLoop, 1 * minute))
}

function resolvePeer(peerID) {
  return ipfs.nameResolve(peerID)
    .then(resolvedKey => {
      if (fetchedKeys.has(resolvedKey)) { return }

      console.log('Peer', decoratePeerID(peerID), 'name resolved to new key', resolvedKey)

      return ipfs.objectGet(resolvedKey + '/allthemusic/contents')
        .catch(handleError('getting contents from peer\'s published key'))
        .then(node => {
          fetchedKeys = fetchedKeys.add(resolvedKey)
          return node
        })
        .then(fetchContent)
    })
    .catch(handleError('looking up peer ' + peerID))
}

clubnet.on('newPeer', peerID => {
  console.log('Found new peer:', decoratePeerID(peerID))
  resolvePeer(peerID)
  if (peerID == myPeerID) { return }
  setInterval(resolvePeer, 1 * minute, peerID)
})

clubnet.on('peer', function (peerID) {
  console.log('Found peer:', decoratePeerID(peerID))
})

ipfs.peerID()
  .then(peerID => {
    myPeerID = peerID
    clubnet.addPeer(myPeerID)
  })
  .catch(handleError('getting local peer ID'))
  .then(getPeers)
  .then(publishLoop)

setInterval(getPeers, 20 * second)
setInterval(preFetchFiles, 1 * second)
