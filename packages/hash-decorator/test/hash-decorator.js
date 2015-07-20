import { HashDecorator } from '..'

import { assert } from 'chai'

describe('HashDecorator', () => {
  var decorator
  beforeEach(() => {
    decorator = new HashDecorator()
  })

  describe('decorateHash', () => {
    function decorateHashTestcase(hash, expectedReturnSuffix) {
      context('when hash = "' + hash + '"', () => {
        it('returns the decorated hash with the suffix "' + expectedReturnSuffix + '"', () => {
          assert.equal(decorator.decorateHash(hash),
                       hash + '-' + expectedReturnSuffix)
        })
      })
    }

    decorateHashTestcase('QmYNmQKp6SuaVrpgWRsPTgCQCnpxUYGq76YEKBXuj2N4H6', 'never-wolf-flat')
    decorateHashTestcase('QmTz3oc4gdpRMKP2sdGUPZTAGRngqjsi99BPoztyP53JMM', 'fatigue-weapon-horror')

    context('with incompatible options', () => {
      context('words represent more bits than the hash contains', () => {
        it('blows up', () => {
          var hash = '9UW6qiPA'
          var parsedHash = decorator.parseHash(hash)
          assert.equal(parsedHash.length * 8, 32)
          // bit length of the hash ^ is less than the bits represented by the
          // words
          assert.equal(decorator.wordCount * decorator.wordBitLength, 33)
          assert.throws(() => decorator.decorateHash(hash))
          // but a hash of this length absolutely works given fewer words
          decorator.wordCount = 2
          assert.doesNotThrow(() => decorator.decorateHash(hash))
        })
      })
    })
  })

  describe('pickWords', () => {
    function pickWordsTestcase(bufferString, expectedReturn, wordCount) {
      context('when buffer contains "' + bufferString + '"', () => {
        var buffer = new Buffer(bufferString)
        it('returns an array of the word indices = ' + expectedReturn, () => {
          if (wordCount) { decorator.wordCount = wordCount }
          assert.deepEqual(decorator.pickWords(buffer), expectedReturn)
        })
      })
    }

    pickWordsTestcase('foobar', [819, 987, 1732])
    pickWordsTestcase('foobar', [819, 987, 1732, 1559], 4)
  })

  describe('getWordAtBitIndex', () => {
    it('uses a default wordBitLength = 11', () => {
      assert.equal(decorator.wordBitLength, 11)
    })

    function getWordAtBitIndexTestcase(bufferString, startIdx, expectedReturn) {
      context('when buffer contains "' + bufferString + '"', () => {
        var buffer = new Buffer(bufferString)
        it('for startIdx = ' + startIdx + ' returns ' + expectedReturn,  () => {
          assert.equal(decorator.getWordAtBitIndex(buffer, startIdx), expectedReturn)
        })
      })
    }

    // these examples were calculated by hand
    getWordAtBitIndexTestcase('foobar', 0, 819)
    getWordAtBitIndexTestcase('foobar', 11, 987)
    getWordAtBitIndexTestcase('foobar', 22, 1732)
  })

  describe('lsb', () => {
    function lsbTestcase(n, byte, expected) {
      it(`given (${n}, 0b${byte.toString(2)}), returns 0b${expected.toString(2)}`, () => {
        assert.equal(decorator.lsb(n, byte), expected)
      })
    }
    lsbTestcase(3, 0b01011, 0b011)
    lsbTestcase(5, 0b01010, 0b01010)
    lsbTestcase(0, 0b01010, 0b0)
    lsbTestcase(1, 0b01010, 0b0)
    lsbTestcase(1, 0b01011, 0b1)
    lsbTestcase(8, 0b01011, 0b01011)
    lsbTestcase(8, 0b10110110, 0b10110110)
  })

  describe('msb', () => {
    function msbTestcase(n, byte, expected) {
      it(`given (${n}, 0b${byte.toString(2)}), returns 0b${expected.toString(2)}`, () => {
        assert.equal(decorator.msb(n, byte), expected)
      })
    }
    msbTestcase(3, 0b10101011, 0b101)
    msbTestcase(5, 0b00001010, 0b00001)
    msbTestcase(0, 0b00001010, 0b0)
    msbTestcase(1, 0b00001010, 0b0)
    msbTestcase(1, 0b10001011, 0b1)
    msbTestcase(8, 0b00001011, 0b00001011)
    msbTestcase(8, 0b10110110, 0b10110110)
  })
})
