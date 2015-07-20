// import R from 'ramda'
import { default as chai, assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import IPFSClient from '../../lib/ipfs-api-client'
import { DagObject } from '../../lib/dag-object'
import { ipfsEndpoint } from '../../lib/util'

chai.use(chaiAsPromised)

var ipfs = new IPFSClient(ipfsEndpoint())
var knownHashes = {
  foo: 'QmWqEeZS1HELySbm8t8U55UkBe75kaLj9WnFb882Tkf5NL'
}

describe('IPFS API Compatibility', () => {
  it.skip('explodes for objects without links or data', () => {
    var obj = new DagObject()
    return assert.isRejected(ipfs.objectPut(obj))
  })

  it('adds objects with links but no data', () => {
    var obj = new DagObject().addLink('fs', knownHashes.foo, 0)
    return assert.isFulfilled(ipfs.objectPut(obj))
  })

  it('adds objects with data but no links', () => {
    var obj = new DagObject({ data: 'foo' })
    return assert.isFulfilled(ipfs.objectPut(obj))
  })

  it('adds objects with data and links', () => {
    var obj = new DagObject({ data: 'foo' }).addLink('foo', knownHashes.foo)
    return assert.isFulfilled(ipfs.objectPut(obj))
  })

  it('explodes trying to add a link with an invalid hash', () => {
    var obj = new DagObject({ data: 'foo' }).addLink('fs', 'notAMultiHash', 0)
    return assert.isRejected(ipfs.objectPut(obj))
  })
})
