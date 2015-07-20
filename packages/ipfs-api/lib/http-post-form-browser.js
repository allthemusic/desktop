export default function (url, files) {
  return new Promise(function (resolve, reject) {
    var fd = new FormData()

    files.forEach(function (file) {
      fd.append(file.name, new Blob([file.file], { type: 'application/json' }))
    })

    var req = new XMLHttpRequest()

    req.onload = function () {
      resolve({
        contentType: req.getResponseHeader('content-type'),
        body: req.responseText,
      })
    }
    req.onerror = reject

    req.open('post', url.href)
    req.send(fd)
  })
}
