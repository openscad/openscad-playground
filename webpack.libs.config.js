import OpenSCADLibrariesPlugin from './webpack-libs-plugin.js';

const buildMode = process.env.LIBS_BUILD_MODE || 'all';

/** @type {import('webpack').Configuration} */
const config = {
    mode: 'none', // We're not actually building JS, just using webpack as a task runner
    entry: './package.json', // Dummy entry point that exists
    output: {
        path: '/tmp', // Output to temp directory
        filename: 'webpack-libs-temp.js', // This won't be used
    },
    plugins: [
        new OpenSCADLibrariesPlugin({
            buildMode: buildMode
        }),
    ],
    stats: 'minimal',
};

export default config;
