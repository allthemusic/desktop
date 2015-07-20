import Base from 'mocha/lib/reporters/base'

// The purpose of this reporter is to provide a less noisy gulp report from
// mocha, so when tests are passing you don't see the full doc-style outline of
// all the passing tests. On failure, you'll see the full list along with errors.

module.exports = function (runner) {
  Base.call(this, runner)

  var self = this

  runner.on('end', function () {
    if (self.failures.length === 0) {
      return
    }
    Base.list(self.failures)
  })
}
