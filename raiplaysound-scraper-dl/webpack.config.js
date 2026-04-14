const path = require('path');
const webpack = require('webpack');

module.exports = {
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
            {
                test: /\.ts$/,
                loader: 'babel-loader'
            },
			{ 
                test: /\.js$/, 
                exclude: /node_modules/, 
                use: ['source-map-loader'],
                enforce: 'pre'
            }
		]
    },
    externals: {
        'electron': 'electron',
        'spawn-sync': 'spawn-sync'
    },
    target: 'node',
    plugins: [
        new webpack.DefinePlugin({
            __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev'),
        }),
    ]
};