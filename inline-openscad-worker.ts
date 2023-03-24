const [workerJsFile, openscadEmscriptenJsFile, outputFile, deploymentUrl] = Deno.args;
console.log(`
  workerJsFile: ${workerJsFile}
  openscadEmscriptenJsFile: ${openscadEmscriptenJsFile}
  outputFile: ${outputFile}
  deploymentUrl: ${deploymentUrl}
`)

const importMetaUrl = `${deploymentUrl}${outputFile.split('/').splice(-1)[0]}`

const workerJs = await Deno.readTextFile(workerJsFile);
const openscadEmscriptenJs = await Deno.readTextFile(openscadEmscriptenJsFile);

const out = `// AUTO GENERATED FILE - DO NOT EDIT
var import_meta_url = '${deploymentUrl}';

${openscadEmscriptenJs.replaceAll(/import.meta.url/g, 'import_meta_url').replaceAll(/export default OpenSCAD;/g, '')}

${workerJs.replaceAll(/import OpenSCAD from .*;/g, '')}
`;

await Deno.writeTextFile(outputFile, out);
