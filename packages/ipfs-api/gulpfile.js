var gulp = require('gulp')
var gutil = require('gulp-util')
var jscs = require('gulp-jscs')
var jshint = require('jshint')
var gulpJshint = require('gulp-jshint')
var jshintStylish = require('jshint-stylish')
var mocha = require('gulp-mocha')
var babel = require('gulp-babel')
var sourcemaps = require('gulp-sourcemaps')
require('babel/register')
var mochaReporter = require('./test/support/gulp-mocha-reporter')
var ipfsMock = require('./test/support/mock-ipfs')

var globs = {
  javascripts: ['{lib,test,bin,demos,script}/**/*.js', '*.js'],
  dist_javascripts: ['lib/**/*.js'],
  package_json: ['package.json'],
  rc_files: ['./.js*rc'],
  unit_tests: ['test/unit/**/*.js'],
  integration_tests: ['test/integration/**/*.js'],
  test_support: ['test/support/**/*.js'],
}

gulp.task('build', function () {
  return gulp.src(globs.dist_javascripts)
    .pipe(sourcemaps.init())
    .pipe(babel({
      optional: ['runtime', 'strict'],
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('watch-build', ['build'], function () {
  return gulp.watch(globs.javascripts, ['build'])
})

gulp.task('jscs', function () {
  return gulp.src(globs.javascripts)
    .pipe(jscs())
})

gulp.task('jshint', function () {
  return gulp.src([].concat(globs.javascripts, globs.package_json, globs.rc_files))
    .pipe(gulpJshint({ linter: jshint.JSHINT }))
    .pipe(gulpJshint.reporter(jshintStylish))
})

gulp.task('lint', ['jscs', 'jshint'])

gulp.task('watch-lint', function () {
  return gulp.watch(globs.javascripts, ['lint'])
})

gulp.task('unit-tests', function () {
  return gulp.src(globs.unit_tests, { read: false })
    .pipe(mocha({ reporter: mochaReporter, }))
    .once('end', function () {
      return ipfsMock.stop()
    })
})

gulp.task('integration-tests', function () {
  return gulp.src(globs.integration_tests, { read: false })
    .pipe(mocha({ reporter: mochaReporter, }))
    .once('end', function () {
      return ipfsMock.stop()
    })
})

gulp.task('test', ['unit-tests', 'lint'])

gulp.task('watch-unit-tests', function () {
  gulp.watch([].concat(globs.dist_javascripts, globs.unit_tests, globs.test_support), ['unit-tests'])
})
gulp.task('watch-integration-tests', function () {
  gulp.watch([].concat(globs.dist_javascripts, globs.integration_tests, globs.test_support), ['integration-tests'])
})

gulp.task('default', [
  'watch-build',
  'watch-lint',
  'watch-unit-tests',
  'test',
  'watch-gulpfile',
])

gulp.task('watch-gulpfile', function () {
  // run a gulp loop like this: `(set -e; while true; do clear; gulp; done)`
  return gulp.watch(__filename, function () {
    gutil.log(__filename + ' has changed; exiting.')
    process.exit()
  })
})
