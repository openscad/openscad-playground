import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace';
import packageConfig from './package.json'

const LOCAL_URL = process.env.LOCAL_URL ?? 'http://localhost:4000/';
const PUBLIC_URL = process.env.PUBLIC_URL ?? packageConfig.homepage;

export default [
  {
    input: 'src/runner/openscad-worker.ts',
    output: {
      file: 'dist/openscad-worker.js',
      format: 'es'
    },
    plugins: [
      typescript(),
      replace({
        preventAssignment: true,
        'import.meta.url': JSON.stringify(process.env.NODE_ENV !== 'production' ? LOCAL_URL : PUBLIC_URL),
      })
    ]
  },
];
