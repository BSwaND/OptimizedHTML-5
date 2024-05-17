let preprocessor = 'sass', // Preprocessor (sass, less, styl); 'sass' also work with the Scss syntax in blocks/ folder.
	fileswatch   = 'html,htm,txt,json,md,woff2' // List of files extensions for watching & hard reload

import pkg from 'gulp'
const { gulp, src, dest, parallel, series, watch } = pkg

import browserSync   from 'browser-sync'
import bssi          from 'browsersync-ssi'
import ssi           from 'ssi'
import webpackStream from 'webpack-stream'
import webpack       from 'webpack'
import TerserPlugin  from 'terser-webpack-plugin'
import gulpSass      from 'gulp-sass'
import dartSass      from 'sass'
import sassglob      from 'gulp-sass-glob'
const  sass          = gulpSass(dartSass)
import less          from 'gulp-less'
import lessglob      from 'gulp-less-glob'
import styl          from 'gulp-stylus'
import stylglob      from 'gulp-noop'
import postCss       from 'gulp-postcss'
import cssnano       from 'cssnano'
import autoprefixer  from 'autoprefixer'
import imagemin      from 'gulp-imagemin'
import changed       from 'gulp-changed'
import concat        from 'gulp-concat'
import rsync         from 'gulp-rsync'
import ftpDeploy 	 from 'ftp-deploy'
import ftp 			 from 'vinyl-ftp'
import rename 		 from 'gulp-rename'
import replace 		 from 'gulp-replace'
import svgmin 		 from 'gulp-svgmin'
import cheerio 		 from 'gulp-cheerio'
import svgSprite     from 'gulp-svg-sprite'
import webp 		 from 'gulp-webp'
import avif 		 from 'gulp-avif'
import plumber 		 from 'gulp-plumber'
import notify 		 from 'gulp-notify'

import {deleteAsync} from 'del'

function browsersync() {
	browserSync.init({
		server: {
			baseDir: 'app/',
			middleware: bssi({ baseDir: 'app/', ext: '.html' })
		},
		ghostMode: { clicks: false },
		notify: true,
		online: true,
		// tunnel: 'yousutename', // Attempt to use the URL https://yousutename.loca.lt
	})
}

function scripts() {
	return src([
		'app/js/*.js',
		'!app/js/*.min.js'
	])
		.pipe(plumber(
			notify.onError({
				title: "JS",
				message: "Error: <%= error.message %>"
			})
		))
		.pipe(webpackStream({
			mode: 'production',
			//mode: 'development',
			performance: { hints: false },
			plugins: [
				new webpack.ProvidePlugin({ $: 'jquery', jQuery: 'jquery', 'window.jQuery': 'jquery' }), // jQuery (npm i jquery)
				// new webpack.ProvidePlugin({ 'window.Swiper': 'Swiper' }), // jQuery (npm i jquery)
			],
			module: {
				rules: [
					{
						test: /\.m?js$/,
						exclude: /(node_modules)/,
						use: {
							loader: 'babel-loader',
							options: {
								presets: ['@babel/preset-env'],
								plugins: ['babel-plugin-root-import']
							}
						}
					}
				]
			},
			optimization: {
				minimize: false,
				minimizer: [
					new TerserPlugin({
						terserOptions: { format: { comments: false } },
						extractComments: false
					})
				]
			},
		}, webpack)).on('error', function (err)  {
			this.emit('end')
		})
		.pipe(concat('app.min.js'))
		.pipe(dest('app/js'))
		.pipe(browserSync.stream())
}

function styles() {
	return src([`app/styles/${preprocessor}/*.*`, `!app/styles/${preprocessor}/_*.*`])
		.pipe(eval(`${preprocessor}glob`)())
		.pipe(eval(preprocessor)({ 'include css': true }))
		.pipe(postCss([
			autoprefixer({ grid: 'autoplace' }),
			cssnano({ preset: ['default', { discardComments: { removeAll: true } }] })
		]))
		.pipe(concat('app.min.css'))
		.pipe(dest('app/css'))
		.pipe(browserSync.stream())
}

function images() {
	return src([
		'app/images/src/**/*',
		'!app/images/src/**/*.svg',
		'!app/images/src/svg',
		'app/images/src/sprite.svg'
	])
		.pipe(changed('app/images/dist'))
		.pipe(imagemin())
		.pipe(dest('app/images/dist'))
		.pipe(browserSync.stream())
}
function svgSprites() {
	return src('app/images/src/svg/**/*')
		.pipe(svgmin({
				js2svg: {
					pretty: true,
				},
			})
		)
		.pipe(cheerio({
				run: function ($) {
					$('[fill]').removeAttr('fill');
					$('[stroke]').removeAttr('stroke');
					$('[style]').removeAttr('style');
				},
				parserOptions: {
					xmlMode: true
				},
			})
		)
		.pipe(replace('&gt;', '>'))
		.pipe(svgSprite({
			mode: {
				stack: {
					sprite: "../sprite.svg"
				}
			},
		}))
		.pipe(dest('app/images/src'));
}
function webpImages() {
	return src([
		'app/images/src/**/**.{jpg,jpeg,png}',
		'!app/images/src/favicon.png'
	])
		.pipe(webp())
		.pipe(dest('app/images/src'))
}

function avifImages() {
	return src([
		'app/images/src/**/**.{jpg,jpeg,png}',
		'!app/images/src/favicon.png'
	])
		.pipe(avif())
		.pipe(dest('app/images/src'))
}

function buildcopy() {
	return src([
		'{app/js,app/css}/*.min.*',
		//'app/images/favicon.ico',
		'!app/images/src/**/*',
		'app/fonts/**/*'
	], { base: 'app/' })
		.pipe(dest('dist'))
}
function moveFiles() {
	return src([
		'app/images/dist/*',
		'app/images/dist/*/*.*',
	])
		.pipe(dest('dist/images/'));
}

function replacePathImg() {
	return src('dist/css/*.*')
		.pipe(replace('/images/dist/', '/images/'))
		.pipe(replace('/images/src/', '/images/'))
		.pipe(dest('dist/css')) // Замените путь на папку, куда нужно сохранить измененный CSS
}

function replacePathImgForHtml() {
	return src([
		'dist/*.html'
	])
		.pipe(replace('images/dist/', 'images/'))
		.pipe(replace('images/src/', 'images/'))
		.pipe(dest('dist/')) // !!!!!Замените путь на папку, куда нужно сохранить измененный
}

async function buildhtml() {
	let includes = new ssi('app/', 'dist/', '/**/*.html')
	includes.compile()
	await deleteAsync('dist/parts', { force: true })
}

async function cleandist() {
	await deleteAsync('dist/**/*', { force: true })
}

function deploy() {
	return src('dist/')
		.pipe(rsync({
			root: 'dist/',
			hostname: 'username@yousite.com',
			destination: 'yousite/public_html/',
			clean: true, // Mirror copy with file deletion
			include: [/* '*.htaccess' */], // Included files to deploy,
			exclude: [ '**/Thumbs.db', '**/*.DS_Store' ],
			recursive: true,
			archive: true,
			silent: false,
			compress: true
		}))
}

function startwatch() {
	watch(`app/styles/${preprocessor}/**/*`, { usePolling: true }, styles)
	watch(['app/js/**/*.js', '!app/js/**/*.min.js'], { usePolling: true }, scripts)
	watch('app/images/src/**/*', { usePolling: true }, images)
	watch(`app/**/*.{${fileswatch}}`, { usePolling: true }).on('change', browserSync.reload)
}


// Задача для загрузки файлов на FTP-сервер
function deployFtp() {
	const globs = [
		'dist/**', // Путь к локальным файлам для загрузки
	];

	// Конфигурация для подключения к FTP-серверу
	const conn = ftp.create({
		host:     '***',
		user:     '***',
		password: '****',
	});

	// Используйте base: './' для сохранения структуры папок
	return src(globs, { base: 'dist/', buffer: true })
		.pipe(conn.newer('/')) // Проверка измененных файлов на сервере
		.pipe(conn.dest('/')); // Загрузка файлов на сервер
}


export { scripts, styles, svgSprites, images, deploy }
export let assets = series(scripts, styles, svgSprites, images, webpImages)
export let webpAvifImages = series(webpImages, avifImages)
export let build = series(cleandist, svgSprites, images, scripts, styles, buildcopy, moveFiles, replacePathImg, buildhtml, replacePathImgForHtml)
export let dd = series(build, deployFtp)

export default series(scripts, styles, svgSprites, images, parallel(browsersync, startwatch))
