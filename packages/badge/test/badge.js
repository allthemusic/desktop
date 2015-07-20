import { assert } from 'chai'
import Badge from 'badge'

describe('Badge', function () {
  var now = Date.now()

  function subject(nameSpace) {
    return new Badge(nameSpace, now)
  }

  describe('name calculation', function () {
    it('generates the correct string without a nameSpace', function () {
      assert.equal(subject().name,
                   'AllTheMusic:' + Math.round(now / (1000 * 60 * 10)))
    })

    it('generates the correct string with a nameSpace', function () {
      var namespace = 'search-term:Queen'
      assert.equal(subject(namespace).name,
                   'AllTheMusic:' + namespace + Math.round(now / (1000 * 60 * 10)))
    })
  })

  describe('dagObject()', function () {
    it('returns a DagObject with the data property set appropriately', function () {
      var badge = subject()
      var dagObject = badge.dagObject()
      assert.equal(dagObject.data, badge.name)
      assert.equal(dagObject.links.size, 0)
    })
  })

  describe('hash()', function () {
    it('is initially null', function () {
      var badge = subject()
      assert.isNull(badge.hash())
    })

    it('can be set via setHash()', function () {
      var badge = subject()
      badge.setHash('foobar')
      assert.equal(badge.hash(), 'foobar')
    })
  })
})
