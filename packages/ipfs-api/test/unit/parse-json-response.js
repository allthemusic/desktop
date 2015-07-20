import { Duplex } from 'stream'
import { assert } from 'chai'
import parseJSONResponse from '../../lib/parse-json-response'
import { concatP } from '../../lib/util'

describe('parseJSONResponse', () => {
  it('correctly parses JSON arriving in chunks', () => {
    var stream = new Duplex()

    stream.push('{"key1": "value1"')
    stream.push('}{"key2": "value2"}{')
    stream.push('"key3": "value3"}')
    stream.push('{"key4": ')
    stream.push('"value4"}')
    stream.push('{"key5": "value5"}{"key6": "value6"}')
    stream.push('{')
    stream.push('"key7":"value7"}')
    stream.push(null)

    stream = stream.pipe(parseJSONResponse())

    return concatP(stream)
      .then(out => {
        assert.deepEqual(out, [
          { key1: 'value1' },
          { key2: 'value2' },
          { key3: 'value3' },
          { key4: 'value4' },
          { key5: 'value5' },
          { key6: 'value6' },
          { key7: 'value7' },
        ])
      })
  })
})
