import R from 'ramda'
import { default as chai, assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import mockIpfs from '../support/mock-ipfs'
import { default as IPFSClient, minimumIPFSVersion } from '../../lib/ipfs-api-client'
import { DagObject } from '../../lib/dag-object'
import { concatP, concatRawP } from '../../lib/util'
import Version from '../../lib/version'

chai.use(chaiAsPromised)

var ipfs = new IPFSClient(mockIpfs.endpoint)

var someStuffToAdd = new Buffer('this is a buffer with some text')

var knownHashes = {
  foo: 'QmWqEeZS1HELySbm8t8U55UkBe75kaLj9WnFb882Tkf5NL',
  someStuffToAdd: 'QmQVnzkcVbpWPPHMRkHERFWixJrFGmuJSKx9BEXqazVsvk',
}

describe('IPFS API', function () {
  afterEach(function () {
    return mockIpfs.reset()
  })

  describe('#assertVersionCompatible()', function () {
    var versionString

    beforeEach(function () {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/version',
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: { Version: versionString },
        },
      }])
    })

    context('when the version is >= the min compatible version', function () {
      before(() => versionString = minimumIPFSVersion.toString())

      it('returns the version', function () {
        var expectedResult = new Version(0, 3, 3)
        return ipfs.assertVersionCompatible().then(result => assert.deepEqual(result, expectedResult))
      })
    })

    context('when the version is < the min compatible version', function () {
      before(() => versionString = '0.1.1')

      it('rejects with an error', function () {
        return assert.isRejected(ipfs.assertVersionCompatible(), /need version .+ but connected to 0.1.1/)
      })
    })
  })

  describe('#version()', function () {
    it('returns the IPFS version of this local node', function () {
      var expectedResult = new Version(0, 3, 3)
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/version',
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: { Version: '0.3.3' },
        },
      }])
      .then(() => ipfs.version())
      .then(result => assert.deepEqual(result, expectedResult))
    })
  })

  describe('#peerID()', function () {
    it('returns the peerID of this local node', function () {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/id',
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: { ID: 'this_is_my_peerid' },
        },
      }])
      .then(() => ipfs.peerID())
      .then(result => assert.equal(result, 'this_is_my_peerid'))
    })
  })

  describe('#objectGet()', function () {
    it('retrieves the dag object described by the given hash', function () {
      var dagNode = new DagObject({ data: 'foo' })
        .addLink('foo', 'QmWqEeZS1HELySbm8t8U55UkBe75kaLj9WnFb882Tkf5NL', 324434)

      // TODO: Ensure the body of the request looks right
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/object/get',
          query: { arg: 'QmMutiHash' },
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: dagNode.asJSONforAPI(),
        },
      }])
      .then(() => ipfs.objectGet('QmMutiHash'))
      .then(result => {
        assert.instanceOf(result, DagObject)
        assert.deepEqual(result, dagNode)
      })
    })
  })

  describe('#objectPut()', function () {
    it('returns a thing with the correct Hash', function () {
      var dagNode = new DagObject({ data: 'foo' })

      // TODO: Ensure the body of the request looks right
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/object/put',
          query: { arg: 'json' },
          method: 'POST',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: {
            Hash: knownHashes.foo,
            Links: [],
          },
        },
      }])
      .then(() => ipfs.objectPut(dagNode))
      .then(result => assert.equal(result, knownHashes.foo))
    })
  })

  describe('#namePublish()', function () {
    it('can publish a key to itself', function () {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/name/publish',
          query: { arg: knownHashes.foo },
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: {
            Name: 'my_peer_id',
            Value: knownHashes.foo,
          },
        },
      }])
      .then(() => ipfs.namePublish(knownHashes.foo))
      .then(response => assert.deepEqual(response.Value, knownHashes.foo))
    })
  })

  describe('#nameResolve()', function () {
    context('requests /name/resolve with the given peerId', function () {
      it('returns the resolved key', function () {
        var peerId = 'peer_id_1234'

        return mockIpfs.mock([{
          request: {
            url: '/api/v0/name/resolve',
            query: { arg: peerId },
            method: 'GET',
          },
          response: {
            headers: { 'content-type': 'application/json' },
            body: { Path: '/ipfs/' + knownHashes.foo },
          },
        }])
        .then(() => ipfs.nameResolve(peerId))
        .then((path) => assert.equal(path, '/ipfs/' + knownHashes.foo))
      })
    })
  })

  describe('#dhtFindprovs()', function () {
    context('the given contentID', function () {
      // FIXME: Make this stub return chunked response correctly
      it('returns array of peerIds who have contentID', function () {
        var contentID = 'this_is_content_id'

        var responseChunks = []
        responseChunks.push({
          Extra: '',
          ID: '',
          Responses: [
            { Addrs: null, ID: 'peer_id_1' },
            { Addrs: null, ID: 'peer_id_2' },
          ],
          Type: 4,
        })
        responseChunks.push({
          Extra: '',
          ID: '',
          Responses: [
            { Addrs: null, ID: 'peer_id_3' },
          ],
          Type: 4,
        })
        responseChunks.push({
          Extra: 'routing: not found',
          ID: '',
          Responses: null,
          Type: 3,
        })

        var buildMultiChunkBody = R.compose(R.reduce((a, b) => a + b, ''), R.map(JSON.stringify))

        return mockIpfs.mock([{
          request: {
            url: '/api/v0/dht/findprovs/this_is_content_id',
            method: 'GET',
          },
          response: {
            headers: { 'content-type': 'application/json' },
            body: buildMultiChunkBody(responseChunks),
          },
        }])
        .then(() => ipfs.dhtFindprovs(contentID))
        .then(concatP)
        .then(R.pluck('ID'))
        .then((peerIDs) => assert.deepEqual(peerIDs, ['peer_id_1', 'peer_id_2', 'peer_id_3']))
      })
    })
  })

  describe('#pinAdd()', function () {
    context('given default options', function () {
      it('resolves after pinning the given ids', function () {
        return mockIpfs.mock([{
          request: {
            url: '/api/v0/pin/add',
            query: { arg: knownHashes.foo },
            method: 'GET',
          },
          response: {
            headers: { 'content-type': 'application/json' },
            body: {
              Pinned: [knownHashes.foo],
            },
          },
        }])
        .then(() => ipfs.pinAdd(knownHashes.foo))
        .then(response => assert.deepEqual(response, [knownHashes.foo]))
      })
    })
  })

  describe('#cat()', function () {
    it('pulls down the raw contents of the file', function () {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/cat',
          query: { arg: knownHashes.foo },
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'text/plain' },
          body: 'foo bar',
        },
      }])
      .then(() => ipfs.cat(knownHashes.foo).then(concatRawP))
      .then(response => assert.deepEqual(response.toString(), 'foo bar'))
    })
  })

  describe('#add()', function () {
    it('accepts a buffer and returns an IPFS key after adding the contents of the buffer to IPFS', () => {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/add',
          query: {},
          method: 'POST',
        },
        response: {
          headers: { 'content-type': 'application/json' },
          body: {
            Name: '_',
            Hash: knownHashes.someStuffToAdd,
          },
        },
      }])
      .then(() => ipfs.add(someStuffToAdd))
      .then(key => {
        assert.equal(key, knownHashes.someStuffToAdd)
      })
    })
  })

  describe('#get()', function () {
    it('forwards the raw response as a stream from ipfs /get', function () {
      return mockIpfs.mock([{
        request: {
          url: '/api/v0/get',
          query: { arg: knownHashes.foo },
          method: 'GET',
        },
        response: {
          headers: { 'content-type': 'application/octet-stream' },
          body: 'foo bar',
        },
      }])
      .then(() => ipfs.get(knownHashes.foo).then(concatRawP))
      .then(response => assert.deepEqual(response.toString(), 'foo bar'))
    })
  })
})
