'use strict'

const gulp = require('gulp')
const plumber = require('gulp-plumber')
const eslint = require('gulp-eslint')

const src = {
  index: 'index.js',
}
const allSrc = [src.index]

gulp.task('lint', () => {
  return gulp.src(allSrc)
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format())
})

gulp.task('build', ['lint'])

gulp.task('watch', () => { gulp.watch(allSrc, ['build']) })

gulp.task('default', ['build'], () => { gulp.start('watch') })
