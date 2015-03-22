'use strict'

var url = require('url')
var assert = require('assert')

var ipfs_endpoint = url.parse(process.env.ipfs_endpoint || process.env.npm_package_config_ipfs_endpoint)
var ipfs = require('../lib/ipfs-api-client')(ipfs_endpoint)
var DagObject = require('../lib/dag-object')

var knownHashes = {
  foo: 'QmWqEeZS1HELySbm8t8U55UkBe75kaLj9WnFb882Tkf5NL'
}

describe('IPFS API', function () {
  describe('addObject', function () {
    it('returns a thing with the correct Hash', function (done) {
      var dagNode = new DagObject({
        data: 'foo'
      })

      ipfs.addObject(dagNode, function (error, result) {
        if (error) {
          return done(error)
        }

        assert.deepEqual(result, {
          Hash: knownHashes.foo,
          Links: []
        })

        done()
      })
    })
  })

  describe('namePublish / nameResolveSelf', function () {
    it('can publish a key to itself and then return the key that was published', function (done) {
      ipfs.namePublish(knownHashes.foo, function (error) {
        if (error) {
          return done(error)
        }

        ipfs.nameResolveSelf(function (error, result) {
          if (error) {
            return done(error)
          }

          assert.deepEqual(result, knownHashes.foo)
          done()
        })
      })
    })
  })

  describe('nameResolve', function () {
    context('requests /name/resolve with the given peerId', function () {
      it.skip('returns the resolved key', function (done) {
        var peerId = 'asdf'

        ipfs.nameResolve(peerId, function (error, hash) {
          if (error) {
            return done(error)
          }

          assert.equal(hash, 'abcdef')
        })
      })
    })
  })
})
