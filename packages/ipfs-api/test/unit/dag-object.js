import { assert } from 'chai'
import { Set } from 'immutable'
import { DagObject, DagLink } from '../../lib/dag-object'

describe('DagObject', function () {
  describe('constructor', function () {
    context('with no arguments', function () {
      it('is empty', function () {
        var node = new DagObject()
        assert.equal(node.data, null)
        assert.instanceOf(node.links, Set)
        assert.equal(node.links.size, 0)
      })
    })

    context('with just links', function () {
      it('it is empty', function () {
        var node = new DagObject({ links: new Set([1, 2, 3]) })
        assert.equal(node.data, null)
        assert.instanceOf(node.links, Set)
        assert.equal(node.links.size, 0)
      })
    })

    context('with just data', function () {
      it('has data but no links', function () {
        var node = new DagObject({ data: 'foobarbaz' })
        assert.equal(node.data, 'foobarbaz')
      })
    })
  })

  describe('#addLink()', function () {
    function makeNode() {
      return new DagObject()
    }

    it('returns the node, for chaining', function () {
      var node = makeNode()
      assert(node.addLink('fakelink1', 'fakehash1') instanceof DagObject)
    })

    it('adds a link to the object with the given name and hash, and maintains order', function () {
      var node = makeNode()
      assert.equal(node.links.size, 0)
      node = node.addLink('name1', 'hash1')
      // node = node.addLink('name1', 'hash1')
      node = node.addLink('name2', 'hash2')
      assert.equal(node.links.size, 2)
      assert.deepEqual(node.links.toJS(), [
        new DagLink('name1', 'hash1', 0),
        new DagLink('name2', 'hash2', 0),
      ])
    })
  })

  describe('#linkNamed()', () => {
    function makeNode() {
      return new DagObject()
        .addLink('foo', 'hash1', 0)
        .addLink('bar', 'hash2', 0)
        .addLink('baz', 'hash3', 0)
    }

    it('returns the link with name matching argument', () => {
      var obj = makeNode()

      assert.equal(obj.linkNamed('bar').hash, 'hash2')
      assert.equal(obj.linkNamed('foo').hash, 'hash1')
    })

    it('throws when name is not found', () => {
      var obj = makeNode()

      assert.throws(() => obj.linkNamed('babaganoush'), /does not exist/)
    })

    it('throws when name is found more than once', () => {
      var obj = makeNode()
      var getBar = () => obj.linkNamed('bar')

      assert.doesNotThrow(getBar)
      obj.addLink('bar', 'QmMutiHash', 0)
      assert.throws(getBar, /multiple/i)
    })
  })

  describe('#asJSONforAPI()', function () {
    function examples(object) {
      var subject = function () {
        return object.asJSONforAPI()
      }
      return function () {
        it('"Data" is present and equal to input', function () {
          var expectedData = object.data || '\b\u0001'
          var actualData = subject().Data
          assert.equal(actualData, expectedData)
        })

        it('"Links" look correct', function () {
          var expectedLinks = object.links.map(function (l) {
            return {
              Name: l.name,
              Hash: l.hash,
              Size: l.size,
            }
          }).toJS()
          assert.deepEqual(subject().Links, expectedLinks)
        })
      }
    }

    context('with only data', examples(new DagObject({ data: 'asdf' })))

    context('with only links', examples(new DagObject()
                                        .addLink('name', 'key1')
                                        .addLink('', 'key2')))

    context('with data & links', examples(new DagObject({ data: 'foo' })
                                          .addLink('name', 'key1')
                                          .addLink('', 'key2', 123)))
  })

  describe('.fromAPI()', () => {
    it('builds a DagObject given raw API-style JS object', () => {
      var rawObj = {
        Data: 'foo',
        Links: [
          {
            Name: 'bar',
            Hash: 'QmFSDF',
            Size: 3426,
          },
          {
            Name: 'biz',
            Hash: 'QmMutiHash',
            Size: 1242,
          },
        ],
      }

      var dagObj = DagObject.fromAPI(rawObj)

      assert.instanceOf(dagObj, DagObject)
      assert.equal(dagObj.data, 'foo')
      assert.equal(dagObj.links.size, 2)
      assert.deepEqual(dagObj.links.toJS()[0], new DagLink('bar', 'QmFSDF', 3426))
      assert.deepEqual(dagObj.links.toJS()[1], new DagLink('biz', 'QmMutiHash', 1242))
    })
  })
})
