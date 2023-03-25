// npx rollup -c
// npx rollup ./src/openscad-worker.ts -o public/openscad-worker-inlined.js -f cjs
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

export default {
	input: 'src/openscad-worker.ts',
	output: {
		file: 'public/openscad-worker-inlined.js',
		format: 'es'
	},
  plugins: [
    typescript({
      // outDir: 'public2',
      rootDir: 'src',
    }),
    replace({
      'import.meta.url': JSON.stringify(process.env.dev
        ? 'http://localhost:3000/'
        : 'https://ochafik.com/openscad/openscad-worker-inlined.js'),
    })
    
  ]
};