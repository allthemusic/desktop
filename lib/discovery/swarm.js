import { debuglog } from 'util'

import { Map } from 'immutable'

import Clubnet from 'clubnet'
import Badge from 'badge'
import Peer from './peer'

const findPeersFrequency = 5000

var log = debuglog('discovery/swarm')

export default class Swarm {
  constructor({ ipfsClient, onKey }={}) {
    this.ipfsClient = ipfsClient
    this.peers = new Map()
    this.myID = null

    this.clubnet = new Clubnet(ipfsClient, () => new Badge())
    this.clubnet.on('peer', peerID => this.addPeer(peerID))
    this.onKey = onKey || Function()

    this.resolvePeerTimeoutHandler = this.resolvePeerTimeoutHandler.bind(this)
  }

  start() {
    return this.ipfsClient.peerID()
      .then(myID => {
        var peer = new Peer(myID)
        log('got my peer id', peer.decoratedID())
        this.myID = myID
        this.clubnet.addPeer(myID)

        return this.clubnet.findPeers()
      })
      .then(() => {
        this.findPeersInterval = setInterval(() => this.clubnet.findPeers(), findPeersFrequency)
      })
      .catch(err => {
        console.log(err.stack)
      })
  }

  allPeerIDs() {
    return this.peers.keySeq()
  }

  schedulePeerResolution(peer) {
    setTimeout(this.resolvePeerTimeoutHandler, peer.resolutionInterval, peer)
  }

  gotKey(key) {
    log('found a rumor key: ' + key)
    process.nextTick(() => this.onKey(key))
  }

  resolvePeerTimeoutHandler(peer) {
    peer.resolve(this.ipfsClient)
      .then(key => {
        console.log(`resolved ${peer.id} to ${key}`)
        this.gotKey(key)
        this.schedulePeerResolution(peer)
      })
      .catch(err => {
        console.error('Failed to resolve peer', peer.id)
      })
  }

  addPeer(peerID) {
    var peer = this.peers.get(peerID)
    if (peer) {
      peer.touch()
    } else {
      peer = new Peer(peerID)
      this.peers = this.peers.set(peerID, peer)
      if (peer.id === this.myID) {
        peer.isLocalNode = true
      } else {
        this.schedulePeerResolution(peer)
        log('New peer: ' + peer.decoratedID())
      }
    }
  }

  addPeers(peersCollection) {
    peersCollection.forEach(p => this.addPeer(p))
  }
}
