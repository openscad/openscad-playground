import CopyPlugin from 'copy-webpack-plugin';
import WorkboxPlugin from 'workbox-webpack-plugin';
import webpack from 'webpack';
import packageConfig from './package.json' with {type: 'json'};

import path, {dirname} from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFilePath = path.resolve(__dirname, '.env');
if (fs.existsSync(envFilePath)) {
  const lines = fs.readFileSync(envFilePath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  }
}

const LOCAL_URL = process.env.LOCAL_URL ?? 'http://localhost:4000/';
const PUBLIC_URL = process.env.PUBLIC_URL ?? packageConfig.homepage;
const isDev = process.env.NODE_ENV !== 'production';


/** @type {import('webpack').Configuration[]} */
const config = [
  {
    entry: './src/index.tsx',
    devtool: isDev ? 'source-map' : 'nosources-source-map',
    mode: isDev ? 'development' : 'production',
    target: 'web',
    // devtool: 'inline-source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                module: 'esnext',
                moduleResolution: 'node',
                target: 'ES2022',
                lib: ['WebWorker', 'ES2022'],
                sourceMap: isDev,
                inlineSources: isDev
              }
            }
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options:{url: false},
            }
          ]
        },
        // {
        //   test: /\.(png|gif|woff|woff2|eot|ttf|svg)$/,
        //   loader: 'url-loader?limit=100000'
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
      static: path.join(__dirname, 'dist'),
      compress: true,
      port: 4000,
      hot: false,
      liveReload: true,
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        NODE_ENV: 'development',
        PLAYGROUND_EDITOR_ENABLED: '',
        PLAYGROUND_EDITOR_TOGGLE: '',
        PLAYGROUND_CUSTOMIZER_OPEN: '',
      }),
      ...(process.env.NODE_ENV === 'production' ? [
        new WorkboxPlugin.GenerateSW({
            exclude: [
              /(^|\/)\./,
              /\.map$/,
              /^manifest.*\.js$/,
            ],
            // these options encourage the ServiceWorkers to get in there fast
            // and not allow any straggling 'old' SWs to hang around
            swDest: path.join(__dirname, 'dist', 'sw.js'),
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
  },
  {
    entry: './src/runner/openscad-worker.ts',
    output: {
      filename: 'openscad-worker.js',
      path: path.resolve(__dirname, 'dist'),
      globalObject: 'self',
      // library: {
      //   type: 'module'
      // }
    },
    devtool: isDev ? 'source-map' : 'nosources-source-map',
    mode: 'production',
    // mode: isDev ? 'development' : 'production',
    target: 'webworker',
    // experiments: {
    //   outputModule: true,
    // },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                module: 'esnext',
                moduleResolution: 'node',
                target: 'ES2022',
                lib: ['WebWorker', 'ES2022'],
                sourceMap: isDev,
                inlineSources: isDev
              }
            }
          },
          exclude: /node_modules/,
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource'
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.mjs', '.wasm'],
      modules: [
        path.resolve(__dirname, 'src'),
        'node_modules'
      ],
      fallback: {
        fs: false,
        path: false,
        module: false
      }
    },
    externals: {
      'browserfs': 'BrowserFS'
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        'process.env.NODE_ENV': 'development',
      }),
    ],
  },
];

export default config;
