import decorateHash from 'hash-decorator'

const healthyResolutionInterval = 60 * 1000
const unhealthyResolutionInterval = 180 * 1000

export default class Peer {
  constructor(id) {
    this.id = id
    this.lastResolved = null
    this.lastDiscovered = Date.now()
    this.resolutionInterval = 0
    this.isLocalNode = false
  }

  decoratedID() {
    var id = decorateHash(this.id)
    if (this.isLocalNode) {
      id = id + ' (local node)'
    }
    return id
  }

  hasResolved() {
    this.lastResolved = Date.now()
  }

  touch() {
    this.lastDiscovered = Date.now()
  }

  resolve(ipfs) {
    return ipfs.nameResolve(this.id)
      .then(key => {
        this.hasResolved()
        this.resolutionInterval = healthyResolutionInterval
        return key
      })
      .catch(err => {
        this.resolutionInterval = unhealthyResolutionInterval
        throw err
      })
  }
}
