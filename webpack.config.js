import CopyPlugin from 'copy-webpack-plugin';
import webpack from 'webpack';
import WorkboxPlugin from 'workbox-webpack-plugin';

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';


/** @type {import('webpack').Configuration[]} */
const config = [
  {
    // Compilers must be named: the dev-server client uses the name to ignore
    // hash updates from the sibling (worker) compiler, which otherwise cause
    // an endless "Cannot find update" full-reload loop.
    name: 'app',
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
              options: { url: false },
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
    // @gltf-transform/core's NodeIO dynamically imports node:fs / node:path; we only use the in-memory API.
    externals: { 'node:fs': 'var undefined', 'node:path': 'var undefined' },
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
      // CI runs the development and production e2e suites at the same time, and the production build rewrites
      // dist/ (which the dev server also serves). With the default static watcher / live reload each of those
      // writes can reload the page under test mid-way, which breaks tests that interact with the UI.
      static: {directory: path.join(__dirname, 'dist'), watch: !process.env.CI},
      liveReload: !process.env.CI,
      compress: true,
      port: 4000,
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        'process.env.NODE_ENV': 'development',
      }),
      // URL of the MCP setup page (e.g. '/mcp'): shows a 'Configure MCP' settings entry when non-empty.
      new webpack.DefinePlugin({
        'process.env.OPENSCAD_MCP_URL': JSON.stringify(process.env.OPENSCAD_MCP_URL ?? ''),
      }),
      ...(process.env.NODE_ENV === 'production' ? [
        new WorkboxPlugin.GenerateSW({
          // Nothing is precached: precaching downloads (with cache: reload) again, at install
          // time, everything the page has just loaded. The Service Worker only has runtime
          // caching rules, and the page copies what it loaded into the caches once the
          // Service Worker controls it (see src/background-loading.ts).
          exclude: [/.*/],
          cleanupOutdatedCaches: true,
          swDest: path.join(__dirname, 'dist', 'sw.js'),
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Big, versioned by their name or rarely changing: stale-while-revalidate.
              urlPattern: ({ url }) => url.origin === self.location.origin
                && (/\/libraries\/[^/]+\.(zip|json)$/.test(url.pathname) || /\/openscad\.wasm$/.test(url.pathname)),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'big', expiration: { maxEntries: 100, purgeOnQuotaError: true } },
            },
            {
              // Cross-origin (Monaco from a CDN).
              urlPattern: ({ url }) => url.origin !== self.location.origin,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'cdn', expiration: { maxEntries: 100, purgeOnQuotaError: true } },
            },
            {
              // The app itself (unhashed file names): always the latest when online.
              urlPattern: ({ request }) => request.method === 'GET',
              handler: 'NetworkFirst',
              options: { cacheName: 'shell', networkTimeoutSeconds: 5 },
            },
          ],
        }),
      ] : []),
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'public'),
            toType: 'dir',
            globOptions: { ignore: ['**/openscad.fallback.js'] },
          },
          {
            // Optional wasm2js build; marked as minimized so Terser skips its ~21MB.
            from: path.resolve(__dirname, 'public/openscad.fallback.js'),
            to: path.resolve(__dirname, 'dist'),
            noErrorOnMissing: true,
            info: { minimized: true },
          },
          {
            from: path.resolve(__dirname, 'node_modules/primeicons/fonts'),
            to: path.resolve(__dirname, 'dist/fonts'),
            toType: 'dir',
          },
          {
            from: path.resolve(__dirname, 'src/wasm/openscad.js'),
            to: path.resolve(__dirname, 'dist'),
          },
          {
            from: path.resolve(__dirname, 'src/wasm/openscad.wasm'),
            to: path.resolve(__dirname, 'dist'),
          },
        ],
      }),
    ],
  },
  {
    name: 'worker',
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
          type: 'asset/resource',
          // Same URL as the copy in dist/ so that index.html can prefetch it.
          generator: { filename: '[name][ext]' },
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
