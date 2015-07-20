'use strict'

import { dag } from 'atm-ipfs-api'

const second = 1000
const tenMinutes = 10 * 60 * second
const prefix = 'AllTheMusic:'

export default class Badge {
  constructor(nameSpace, now) {
    now = now || Date.now()
    var periodsSinceEpoch = Math.round(now / tenMinutes)
    nameSpace = nameSpace || ''
    this._hash = null
    this.name =  prefix + nameSpace + periodsSinceEpoch
  }

  dagObject() {
    return new dag.DagObject({ data: this.name })
  }

  hash() {
    // eventually this will actually calculate the hash, but for now, we're
    // shoving the hash from IPFS back into this object
    return this._hash
  }

  setHash(hash) {
    this._hash = hash
  }
}
