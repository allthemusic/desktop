'use strict'

var http = require('http')
var FormData = require('form-data')

function DagNode(links, data) {
  this.links = links
  if (!links) {
    this.links = []
  }
  this.data = data
  if (!data) {
    this.data = ''
  }
}

DagNode.prototype.asJSONforAPI = function () {
  var data_enc = new Buffer(this.data).toString('base64')
  var dag_object = {
    Links: this.links,
    Data: data_enc,
  }

  return new Buffer(JSON.stringify(dag_object))
}

var nameResolve = function (_peerId, cb) {
  var request = http.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v0/name/resolve',
    method: 'GET'
  })

  request.on('response', function (response) {
    var responseBody = ''
    response.setEncoding('utf8')

    response.on('data', function (chunk) {
      responseBody += chunk
    })

    response.on('end', function () {
      var obj = JSON.parse(responseBody)
      if (response.statusCode === 200) {
        cb(null, obj.Key)
      } else {
        cb(obj, null)
      }
    })
  })

  request.on('error', function (e) {
    cb(e, null)
  })

  request.end()
}

exports.DagNode = DagNode
exports.nameResolveSelf = function (cb) {
  nameResolve(null, cb)
}

exports.namePublish = function (value, cb) {
  var request = http.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v0/name/publish?arg=' + value,
    method: 'GET'
  })

  request.on('response', function (response) {
    var responseBody = ''
    response.setEncoding('utf8')

    response.on('data', function (chunk) {
      responseBody += chunk
    })

    response.on('end', function () {
      var obj = JSON.parse(responseBody)
      if (response.statusCode === 200) {
        cb(null)
      } else {
        cb(obj)
      }
    })
  })

  request.on('error', function (e) {
    cb(e, null)
  })

  request.end()
}

exports.addObject = function (dagNode, cb) {
  var form = new FormData()
  form.append('data', dagNode.asJSONforAPI(), {
    filename: '_',
    contentType: 'application/json'
  })

  var request = http.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v0/object/put?arg=json',
    method: 'POST',
    headers: form.getHeaders()
  })
  request.on('response', function (res) {
    var responseBody = ''
    res.setEncoding('utf8')

    res.on('data', function (chunk) {
      responseBody += chunk
    })

    res.on('end', function () {
      var obj = JSON.parse(responseBody)
      if (res.statusCode !== 200) {
        cb(obj, null)
      } else {
        cb(null, obj)
      }
    })
  })

  request.on('error', function (e) {
    cb(e, null)
  })

  form.pipe(request)

  request.end()
}
