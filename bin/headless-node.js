#!/usr/bin/env babel-node

// import util from 'util'
import { Set } from 'immutable'
import R from 'ramda'
import { IPFSClient, DagObject, util as ipfsUtil } from 'atm-ipfs-api'
import Clubnet from '../lib/clubnet'
import Badge from '../lib/badge'

var ipfs = new IPFSClient(ipfsUtil.ipfsEndpoint())
var clubnet = new Clubnet(ipfs, () => new Badge())

var fetchedKeys = new Set()
var tracks = new Set()
var myPeerID

const second = 1000
const minute = 60 * second

function decoratePeerId(peerId) {
  return '[' + (peerId === myPeerID ? 'local node' : peerId) + ']'
}

function publish(key) {
  console.log('publishing:', key)
  console.time('publish: ' + key)
  return ipfs.namePublish(key)
    .then(() => console.timeEnd('publish: ' + key))
    .catch(handleError('publish'))
}

function wearBadge() {
  return clubnet.wearBadge().then(key => {
    console.log('badge key =', key._hash)
    return key
  }).catch(handleError('wearBadge'))
}

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

function fetchContent(thisPeersContents) {
  var contents = new Set().union(R.pluck('Hash', thisPeersContents.Links))
  contents = contents.subtract(fetchedKeys)

  contents.forEach(id => {
    ipfs.objectGet(id)
      .then(object => {
        fetchedKeys = fetchedKeys.add(id)
        tracks = tracks.add(id)
        var metadata = JSON.parse(object.Data)
        // metadata.id = id
        console.log('new track [%s]: %s - %s', id, metadata.artist, metadata.title)
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

clubnet.on('newPeer', peerId => console.log('Found new peer: ', peerId))

clubnet.on('peer', function (peerId) {
  ipfs.nameResolve(peerId)
    .then(resolvedKey => {
      if (fetchedKeys.has(resolvedKey)) { return }

      console.log('Peer', decoratePeerId(peerId), 'name resolved to new key', resolvedKey)

      var getP = ipfs.objectGet(resolvedKey + '/allthemusic/contents')
      getP.then(() => fetchedKeys = fetchedKeys.add(resolvedKey))
      return getP.then(fetchContent)
    })
    .catch(handleError('looking up peer ' + peerId))
})

ipfs.peerID()
  .then(peerId => {
    myPeerID = peerId
    clubnet.addPeer(myID)
  })
  .catch(handleError('getting local peer ID'))
  .then(getPeers)
  .then(publishLoop)

setInterval(getPeers, 20 * second)
