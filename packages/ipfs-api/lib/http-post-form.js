import util from 'util'
import http from 'http'
import FormData from 'form-data'

export default function (url, files) {
  return new Promise(function (resolve, reject) {
    var form = new FormData()

    files.forEach(function (file) {
      form.append(file.name, file.file, {
        filename: '_',
        contentType: 'application/json',
      })
    })

    var request = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: 'POST',
      headers: form.getHeaders(),
    })

    request.on('response', function (response) {
      var responseBody = ''

      response.on('data', function (chunk) {
        responseBody += chunk
      })

      response.on('end', function () {
        if (response.statusCode === 200) {
          resolve({
            contentType: response.headers['content-type'],
            body: responseBody,
          })
        } else {
          reject(new Error(
            util.format('[IPFS %s %s]: status = %s, body = `%s`',
              'POST',
              url.path,
              response.statusCode,
              responseBody)))
        }
      })
    })

    request.on('error', reject)

    if (form) {
      form.pipe(request)
    }

    request.end()
  })
}
