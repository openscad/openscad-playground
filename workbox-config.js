module.exports = {
	globDirectory: 'dist/',
	globPatterns: [
		'**/*.{js,txt,wav,ico,eot,svg,ttf,woff,woff2,css,html,zip,png,json,wasm,jpg}'
	],
	swDest: 'dist/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};