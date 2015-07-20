import { Set } from 'immutable'

export class DagLink {
  constructor(name, hash, size) {
    this.name = name || null
    this.hash = hash || null
    this.size = size || 0
  }

  asJSONforAPI() {
    return {
      Name: this.name,
      Hash: this.hash,
      Size: this.size,
    }
  }
}

export class DagObject {
  constructor({ data }={}) {
    this.links = new Set()
    this.data = data
  }

  asJSONforAPI() {
    return {
      Links: this.links.toJS().map(l => l.asJSONforAPI()),
      Data: this.data ? this.data : '\u0008\u0001',
    }
  }

  addLink(name, hash, size) {
    var link = new DagLink(name, hash, size)
    this.links = this.links.add(link)
    return this
  }

  linkNamed(name) {
    var nameMatches = (link => link.name == name)
    switch (this.links.count(nameMatches)) {
      case 1: { return this.links.find(nameMatches) }
      case 0: { throw new Error(`Link named ${name} does not exist`) }
      default: { throw new Error(`Multiple links named ${name} exist`) }
    }
  }

  static fromAPI(rawObject) {
    var dagObj = new DagObject({ data: rawObject.Data })
    rawObject.Links.forEach(link => {
      dagObj.addLink(link.Name, link.Hash, link.Size)
    })
    return dagObj
  }
}

export default DagObject
