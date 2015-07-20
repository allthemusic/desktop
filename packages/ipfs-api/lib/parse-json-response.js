import through from 'through2'

// some IPFS API responses are many JSON objects concatenated together; as far
// as I can tell, this is the best way to parse this without writing a parser
export default function parseJSONResponse() {
  var buffer = ''
  return through.obj(function (chunk, enc, cb) {
    chunk = buffer + chunk.toString()
    var segment
    while (chunk.length > 0) {
      var splitPoint = chunk.indexOf('}{') + 1
      if (splitPoint > 0) {
        segment = chunk.slice(0, splitPoint)
        chunk = chunk.slice(splitPoint)
      } else {
        segment = chunk
        chunk = ''
      }
      try {
        this.push(JSON.parse(segment))
        buffer = ''
      } catch (err) {
        buffer = segment
      }
    }

    cb()
  })
}
