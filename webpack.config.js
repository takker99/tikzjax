const path = require("path");
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
	let tikzjaxConfig = {
		name: "TikZJax",
		mode: "production",
		entry: {
			'TikZJax': './src/index.js',
		},
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: '[name].js'
		},
		module: {
			rules: [
				{
					test: /\.gz/,
					type: 'asset/inline',
				},
				{
					test: /\.css$/,
					use: ["style-loader", "css-loader"]
				}
			]
		},
		performance: {
			hints: false
		},
		plugins: [
			new webpack.ProvidePlugin({
				process: 'process/browser'
			})
		]
	};

	if (argv.mode == "development") {
		console.log("Using development mode.");
		tikzjaxConfig.mode = "development";
		tikzjaxConfig.devtool = "source-map";
	} else {
		console.log("Using production mode.");
		// This prevents the LICENSE file from being generated.  It also minimizes the code even in development mode,
		// which is why it is here.
		tikzjaxConfig.plugins.push(new TerserPlugin({
			terserOptions: { format: { comments: false } },
			extractComments: false
		}));
	}

	return [tikzjaxConfig];
};
