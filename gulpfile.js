'use strict';

var gulp = require('gulp');
var clangFormat = require('clang-format');
var gulpFormat = require('gulp-clang-format');
var runSequence = require('run-sequence');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
var tslint = require('gulp-tslint');
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var semver = require('semver');

var runSpawn = function(done, task, opt_arg, opt_io) {
  opt_arg = typeof opt_arg !== 'undefined' ? opt_arg : [];
  var stdio = 'inherit';
  if (opt_io === 'ignore') {
    stdio = 'ignore';
  }
  var child = spawn(task, opt_arg, {stdio: stdio});
  var running = false;
  child.on('close', function() {
    if (!running) {
      running = true;
      done();
    }
  });
  child.on('error', function() {
    if (!running) {
      console.error('gulp encountered a child error');
      running = true;
      done();
    }
  });
};

gulp.task('tslint', function() {
  return gulp.src(['lib/**/*.ts', 'spec/**/*.ts', '!spec/install/**/*.ts'])
      .pipe(tslint()).pipe(tslint.report());
});

gulp.task('lint', function(done) {
  runSequence('tslint', 'jshint', 'format:enforce', done);
});

// prevent contributors from using the wrong version of node
gulp.task('checkVersion', function(done) {
  // read minimum node on package.json
  var packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json')));
  var protractorVersion = packageJson.version;
  var nodeVersion = packageJson.engines.node;

  if (semver.satisfies(process.version, nodeVersion)) {
    done();
  } else {
    throw new Error('minimum node version for Protractor ' +
        protractorVersion + ' is node ' + nodeVersion);
  }
});


gulp.task('built:copy', function() {
  return gulp.src(['lib/**/*','!lib/**/*.ts'])
      .pipe(gulp.dest('built/'));
});

gulp.task('webdriver:update', function(done) {
  runSpawn(done, 'node', ['bin/webdriver-manager', 'update']);
});

gulp.task('jshint', function(done) {
  runSpawn(done, 'node', ['node_modules/jshint/bin/jshint', '-c',
      '.jshintrc', 'lib', 'spec', 'scripts',
      '--exclude=lib/selenium-webdriver/**/*.js,lib/webdriver-js-extender/**/*.js,' +
      'spec/dependencyTest/*.js,spec/install/**/*.js']);
});

gulp.task('format:enforce', function() {
  var format = require('gulp-clang-format');
  var clangFormat = require('clang-format');
  return gulp.src(['lib/**/*.ts']).pipe(
    format.checkFormat('file', clangFormat, {verbose: true, fail: true}));
});

gulp.task('format', function() {
  var format = require('gulp-clang-format');
  var clangFormat = require('clang-format');
  return gulp.src(['lib/**/*.ts'], { base: '.' }).pipe(
    format.format('file', clangFormat)).pipe(gulp.dest('.'));
});

gulp.task('tsc', function(done) {
  runSpawn(done, 'node', ['node_modules/typescript/bin/tsc']);
});

gulp.task('tsc:spec', function(done) {
  runSpawn(done, 'node', ['node_modules/typescript/bin/tsc', '-p', 'ts_spec_config.json']);
});

gulp.task('tsc:es5', function(done) {
  runSpawn(done, './scripts/compile_to_es5.sh');
});

gulp.task('compile_to_es5', function(done) {
  runSequence('checkVersion', 'tsc:es5', 'built:copy', done);
});

gulp.task('prepublish', function(done) {
  runSequence(['typings', 'jshint', 'format'], 'tsc', 'tsc:globals', 'types',
    'ambient', 'built:copy', done);
});

gulp.task('pretest', function(done) {
  runSequence('checkVersion',
    ['webdriver:update', 'jshint', 'tslint', 'format'], 'tsc', 'built:copy', 'tsc:spec',  done);
});

gulp.task('default',['prepublish']);
