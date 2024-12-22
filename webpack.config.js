const CopyPlugin = require("copy-webpack-plugin");
const WorkboxPlugin = require('workbox-webpack-plugin');
const webpack = require('webpack');

const path = require('path');

module.exports = [{
  entry: './src/index.tsx',
  // devtool: 'inline-source-map',
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
         "style-loader",
         {
          loader: 'css-loader',
          options:{url: false},
        }
        ]
      },
      // {
      //   test: /\.(png|gif|woff|woff2|eot|ttf|svg)$/,
      //   loader: "url-loader?limit=100000"
      // },
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
    new webpack.EnvironmentPlugin({
      'process.env.NODE_ENV': 'development',
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new WorkboxPlugin.GenerateSW({
          exclude: [
            /\.map$/,
            /^manifest.*\.js$/,
            /.*?\.DS_Store$/,
          ],
          // these options encourage the ServiceWorkers to get in there fast     
          // and not allow any straggling "old" SWs to hang around     
          swDest: path.join(__dirname, "dist", 'sw.js'),
          maximumFileSizeToCacheInBytes: 200 * 1024 * 1024,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [{
            urlPattern: ({request, url}) => true,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'all',
              expiration: {
                maxEntries: 1000,
                purgeOnQuotaError: true,
              },
            },
          }],
      }),
    ] : []),
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, 'public'),
          toType: 'dir',
        },
        { 
          from: path.resolve(__dirname, 'node_modules/primeicons/fonts'),
          to: path.resolve(__dirname, 'dist/fonts'),
          toType: 'dir',
        },
        { 
          from: path.resolve(__dirname, 'src/wasm/openscad.js'),
          from: path.resolve(__dirname, 'src/wasm/openscad.wasm'),
        },
      ],
    }),
  ],
}/*, {
  entry: './src/sw.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'sw.js',
    path: path.resolve(__dirname, 'dist'),
  },
}*/];
