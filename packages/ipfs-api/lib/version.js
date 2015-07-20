function toInt(str) {
  if (!str) {
    return 0
  }
  var i = parseInt(str)
  if (isNaN(i)) {
    return 0
  }
  return i
}

export default class Version {
  constructor(major, minor, patch) {
    this.major = toInt(major)
    this.minor = toInt(minor)
    this.patch = toInt(patch)
  }

  static parseString(versionStr) {
    var [major, minor, patch] = versionStr.split('.', 3)
    return new Version(major, minor, patch)
  }

  eq(other) {
    return this.major == other.major &&
      this.minor == other.minor &&
      this.patch == other.patch
  }

  gte(other) {
    return this.major >= other.major &&
      this.minor >= other.minor &&
      this.patch >= other.patch
  }

  toString() {
    return this.major + '.' + this.minor + '.' + this.patch
  }
}
