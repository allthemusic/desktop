import { debuglog } from 'util'

import { Set } from 'immutable'
import R from 'ramda'

import decorateHash from 'hash-decorator'
import Swarm from './swarm'
import PubTree from './pub-tree'
import Tracklist from './tracklist'
import Updater from '../update/updater'
import trackActions from '../actions/tracks'

var log = debuglog('discovery')

class DiscoveryService {
  constructor({ ipfsClient, releaseBasePath, onVerifiedRelease }={}) {
    this.ipfsClient = ipfsClient
    this.tracklist = new Tracklist()
    this.swarm = new Swarm({
      ipfsClient,
      onKey: this.processNewPubTree.bind(this),
    })

    this.updater = new Updater({
      ipfsClient,
      basePath: releaseBasePath,
      onVerifiedRelease: onVerifiedRelease || Function(),
    })

    this.myPubTree = new PubTree()

    this.sendBatchToTrackStore = this.sendBatchToTrackStore.bind(this)
    this.publishMyPubtree = this.publishMyPubtree.bind(this)
  }

  start() {
    this.swarm.start()
    this.trackBatchInterval = setInterval(this.sendBatchToTrackStore, 500)
    this.publishTimeout = setTimeout(this.publishMyPubtree, 5000)
  }

  publishMyPubtree() {
    this.myPubTree.peers = this.swarm.allPeerIDs()
    this.myPubTree.release = this.updater.currentVerifiedRelease
    this.myPubTree.tracks = this.tracklist.knownIDs

    log('publishing!', {
      peers: this.myPubTree.peers.count(),
      tracks: this.myPubTree.tracks.count(),
      release: this.myPubTree.release,
    })
    return this.myPubTree.publish(this.ipfsClient)
      .then(() => {
        log('published successfully')
        this.publishTimeout = setTimeout(this.publishMyPubtree, 60000)
      })
      .catch(err => {
        log('error while publishing', err)
        this.publishTimeout = setTimeout(this.publishMyPubtree, 60000)
      })
  }

  sendBatchToTrackStore() {
    if (this.tracklist.latestBatch.isEmpty()) { return }
    trackActions.addMulti(this.tracklist.getAndFlushLatestBatch().toJS())
  }

  processNewPubTree(key) {
    return PubTree.fromIPFS(key, this.ipfsClient).then(pubTree => {
      this.tracklist.fetchMulti(pubTree.tracks, this.ipfsClient)
      if (pubTree.release) {
        this.updater.tryRelease(pubTree.release)
      }
      this.swarm.addPeers(pubTree.peers)
    })
    .catch(err => {
      console.error(`Error while fetching PubTree ${key}`, err)
    })
  }
}

export default DiscoveryService
