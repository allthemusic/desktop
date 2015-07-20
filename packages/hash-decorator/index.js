import multihash from 'multihashes'
import b58 from 'bs58'
import defaultWordlist from './words'

export class HashDecorator {
  constructor(opts={}) {
    this.wordCount = opts.wordCount || 3
    this.wordList = opts.wordList || defaultWordlist
    this.wordBitLength = Math.log2(this.wordList.length)
    if (this.wordBitLength != Math.floor(this.wordBitLength)) {
      throw new Error('Use a wordlist that is a multiple of 2 in length')
    }
  }

  decorateHash(hash) {
    var parsedHash = this.parseHash(hash)
    var wordIndices = this.pickWords(parsedHash.digest)
    var decorated = [hash]
    wordIndices.forEach(idx => decorated.push(this.wordList[idx]))
    return decorated.join('-')
  }

  parseHash(hash) {
    return multihash.decode(new Buffer(b58.decode(hash)))
  }

  pickWords(digestBuffer) {
    var words = []
    for (var i = 0; i < this.wordCount; i++) {
      words[i] = this.getWordAtBitIndex(digestBuffer, i * this.wordBitLength)
    }
    return words
  }

  getWordAtBitIndex(buffer, startIdx) {
    var startByte = Math.floor(startIdx / 8)
    var startBit = startIdx % 8
    var endIdx = startIdx + this.wordBitLength
    var endByte = Math.floor(endIdx / 8)
    var endBit = endIdx % 8

    if (endByte >= buffer.length) { throw new Error('Multihash too short!') }

    var word = 0
    for (var b = startByte; b <= endByte; b++) {
      var shift = 8
      var byte = buffer[b]
      if (b == startByte) {
        shift = 0
        byte = this.lsb(8 - startBit, byte)
      } else if (b == endByte) {
        shift = endBit
        byte = this.msb(endBit, byte)
      }
      word <<= shift
      word += byte
    }
    return word
  }

  // msb and lsb accept a number of bits and a single byte. They return either
  // the N most or N least significant bits, respectively.
  msb(n, byte) {
    var mask = 0xFF - (0xFF >> n)
    return (byte & mask) >> (8 - n)
  }

  lsb(n, byte) {
    var mask = 0xFF >> (8 - n)
    return byte & mask
  }
}

export default function (hash) {
  return new HashDecorator().decorateHash(hash)
}
