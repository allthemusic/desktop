import fs from 'fs'
import path from 'path'
import proc from 'child_process'

import R from 'ramda'
import del from 'del'
import electron from 'electron-prebuilt'
import gulp from 'gulp'
import gulpBabel from 'gulp-babel'
import gulpJshint from 'gulp-jshint'
import gulpReact from 'gulp-react'
import jscs from 'gulp-jscs'
import jsxhint from 'jshint-jsx'
import livereload from 'gulp-livereload'
import mocha from 'gulp-mocha'
import newer from 'gulp-newer'
import plumber from 'gulp-plumber'
import sourcemaps from 'gulp-sourcemaps'

import packageJSON from './package.json'

var electronCtxPath = path.resolve(__dirname, 'dist')
var electronBinPath = process.env.ELECTRON_PATH || electron
var electronVersion = packageJSON.devDependencies['electron-prebuilt']

var globs = {
  bin: ['./bin/*.js'],
  dest: ['./dist'],
  distCompiled: ['./dist/{lib,static,resources}'],
  gulpfile: [__filename],
  integration_tests: ['test/integration/**/*.js'],
  javascripts: ['./lib/**/*.js'],
  package_json: ['./package.json'],
  rc_files: ['./.js*rc'],
  static: ['./static/**/*', './resources/**/*'],
  test_support: ['test/support/**/*.js'],
  unit_tests: [
    'test/unit/**/*.js',
    'packages/*/test/**/*.js',
  ],
}

globs.allJS = [].concat(
  globs.javascripts,
  globs.bin,
  globs.gulpfile,
  globs.unit_tests,
  globs.integration_tests,
  globs.test_support
)

globs.allJSON = [].concat(
  globs.rc_files,
  globs.package_json
)

gulp.task('default', [
  'livereload',
  'watch',
  'watch-unit-tests',
])

function jsBundle(cb) {
  cb = R.once(cb)
  let errorHandler = err => {
    console.error(err.stack)
    cb(err)
  }
  gulp.src(globs.javascripts, { base: '.' })
    .pipe(plumber(errorHandler))
    .pipe(newer(globs.dest[0]))
    .pipe(sourcemaps.init())
    .pipe(gulpBabel())
    .pipe(gulpReact())
    .pipe(plumber.stop())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(globs.dest[0]))
    .pipe(livereload())
    .on('end', cb)
}
gulp.task('js-bundle', jsBundle)
gulp.task('js-bundle:clean', ['dist:clean'], jsBundle)

function staticBundle() {
  return gulp.src(globs.static, { base: '.' })
    .pipe(newer(globs.dest[0]))
    .pipe(gulp.dest(globs.dest[0]))
    .pipe(livereload())
}
gulp.task('static-bundle', staticBundle)
gulp.task('static-bundle:clean', ['dist:clean'], staticBundle)

gulp.task('watch', () => {
  gulp.start('js-bundle')
  gulp.start('static-bundle')
  gulp.start('lint')

  gulp.watch([].concat(globs.static, globs.allJS, globs.allJSON), () => {
    gulp.start('static-bundle', 'js-bundle', 'lint')
  })
})

gulp.task('jscs', ['js-bundle'], () => {
  return gulp.src(globs.allJS, { base: '.' })
    .pipe(jscs())
})

gulp.task('jshint', ['js-bundle'], () => {
  return gulp.src([].concat(globs.allJS, globs.allJSON), { base: '.' })
    .pipe(gulpJshint({ linter: jsxhint.JSXHINT }))
})

gulp.task('livereload', () => {
  return livereload.listen({ port: 35729 })
})

gulp.task('electron', ['js-bundle', 'static-bundle'], () => {
  console.log('Starting electron shell ', electronBinPath)
  var log = fs.openSync('./log/electron.log', 'a')
  var electronProc = proc.spawn(electronBinPath, ['--disable-http-cache', electronCtxPath], {
    stdio: ['ignore', log, log],
    detached: true,
    env: R.merge(process.env, {
      GULP: 'true',
      NODE_DEBUG: [
        'boot',
        'discovery',
        'discovery/swarm',
        'ipfs-daemon',
        'storage',
        'updater',
      ].join(','),
    }),
  })
  electronProc.unref()
  console.log('Electron has been started. Watch log/electron.log for output')
})

gulp.task('lint', ['jscs', 'jshint'])


gulp.task('unit-tests', ['js-bundle'], () => {
  return gulp.src(globs.unit_tests, { read: false })
    .pipe(mocha({ reporter: testReporter(), }))
})

gulp.task('integration-tests', ['js-bundle'], () => {
  return gulp.src(globs.integration_tests, { read: false })
    .pipe(mocha({ reporter: testReporter(), }))
})

gulp.task('test', ['unit-tests', 'lint'])

gulp.task('watch-unit-tests', () => {
  gulp.start('unit-tests')
  gulp.watch([].concat(globs.javascripts, globs.unit_tests, globs.test_support, globs.static, globs.package_json), () => {
    gulp.start('unit-tests')
  })
})

gulp.task('watch-unit-tests-spec-reporter', (done) => {
  process.env.SPEC_REPORTER = '1'
  gulp.start('watch-unit-tests', done)
})

gulp.task('watch-integration-tests', () => {
  gulp.start('integration-tests')
  gulp.watch([].concat(globs.javascripts, globs.integration_tests, globs.test_support, globs.static, globs.package_json), () => {
    gulp.start('integration-tests')
  })
})

gulp.task('dist:clean', (done) => {
  del(globs.distCompiled, done)
})

gulp.task('dist', ['dist:clean', 'js-bundle:clean', 'static-bundle:clean'])

gulp.task('build-linux-x64', ['dist'], buildRelease('linux', 'x64'))
gulp.task('build-linux-ia32', ['dist'], buildRelease('linux', 'ia32'))
gulp.task('build-linux', ['build-linux-x64', 'build-linux-ia32'])
gulp.task('build-osx', ['dist'], buildRelease('darwin', 'x64'))
gulp.task('build', ['build-osx', 'build-linux'])

function testReporter() {
  return process.env.SPEC_REPORTER ? 'spec' : require('./test/support/gulp-mocha-reporter')
}

function buildRelease(os, arch) {
  return () => {
    return require('./utils/release-package')({
      os,
      arch,
      electronVersion,
      name: packageJSON.name,
      version: packageJSON.version,
      outputDir: path.resolve(__dirname, './pkg'),
      inputDir: electronCtxPath,
    })
  }
}
