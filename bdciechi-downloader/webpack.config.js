const path = require('path');

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, 'index.js'),
	output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'build')
    },
    node: {
        __dirname: false
    },
    resolve: {
        extensions: ['.js', '.json']
    },
	module: {
		rules: [
			{ test: /\.js$/, loader: "babel-loader" }
		]
    },
    externals: {
        'electron': 'electron',
        'spawn-sync': 'spawn-sync'
    },
    target: 'node'
};