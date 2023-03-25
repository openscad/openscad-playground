const CopyPlugin = require("copy-webpack-plugin");

const path = require('path');

module.exports = {
  entry: './src/index.tsx',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [
         {
          loader: 'css-loader',
          options:{url: false},
        }
        ]
      },
      {
        test: /\.(png|gif|woff|woff2|eot|ttf|svg)$/,
        loader: "url-loader?limit=100000"
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    static: path.join(__dirname, "dist"),
    compress: true,
    port: 4000,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, 'public'),
          toType: 'dir',
        },
        { 
          from: path.resolve(__dirname, 'src/wasm/openscad.js'),
          from: path.resolve(__dirname, 'src/wasm/openscad.wasm'),
        },
      ],
    }),
  ],
};