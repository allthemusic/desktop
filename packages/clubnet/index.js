'use strict'

import EventEmitter from 'events'
import { Set } from 'immutable'
import mapStream from 'through2-map'
import { util as ipfsUtil } from 'atm-ipfs-api'

export default class Clubnet extends EventEmitter {
  constructor(ipfsClient, badgeBuilderFunc) {
    super()
    this.buildBadge = badgeBuilderFunc
    this.ipfsClient = ipfsClient
    this.badge = this.buildBadge()
  }

  wearBadge() {
    this.updateBadge()
    this.emit('wearBadge:start')

    return this.ipfsClient.objectPut(this.badge.dagObject()).then(result => {
      this.badge.setHash(result)
      this.emit('wearBadge:done')
      return this.badge
    })
  }

  updateBadge() {
    var newBadge = this.buildBadge()

    if (newBadge.name != this.badge.name) {
      this.emit('badgeChanged', newBadge)
      this.badge = newBadge
    }
  }

  addPeer(peerID) {
    this.emit('peer', peerID)
    return peerID
  }

  findPeers() {
    this.updateBadge()

    // TODO: This is not the correct behavior, but for now, if we don't yet have
    // a hash stored in the badge, the only way to learn the hash is to add it
    // to IPFS
    var badgeP = this.badge.hash() ? Promise.resolve(this.badge) : this.wearBadge()

    return badgeP.then(badge => {
      return this.ipfsClient.dhtFindprovs(badge.hash())
        .then(stream => {
          var mapper = mapStream.obj(peer => this.addPeer(peer.ID))
          return stream.pipe(mapper)
        })
        .then(ipfsUtil.concatP)
    })
  }
}
