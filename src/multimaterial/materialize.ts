import UZIP from "uzip";
import { RGBColor, findClosestColor, hexToRgb, rgbToLab } from "./colors";

export async function materialize3MFFile(file: File, extruderRGBColors: RGBColor[]): Promise<File> {
  if (extruderRGBColors.length === 0) {
    throw new Error('Please provide extruder colors.');
  }
  const labColors = extruderRGBColors.map(rgb => rgbToLab(rgb));
    // const zip = new JSZip();
    const data = await file.arrayBuffer();
    // const contents = await zip.loadAsync(data);
    const contents = UZIP.parse(data);
    console.log(contents)
    // const modelFile = contents.file(/.*\.model$/)[0];
    const modelFile = Object.keys(contents).filter(n => n.match(/.*\.model$/))[0];
    if (!modelFile) {
        throw new Error('No .model file found in the 3MF package.');
    }

    // const xmlInput = await modelFile.async('text');
    const xmlInput = new TextDecoder().decode(contents[modelFile]);
    const xmlDoc = new DOMParser().parseFromString(xmlInput, 'application/xml');

    const model = xmlDoc.querySelector('model')!;
    const metadataToAdd = [
        { name: 'BambuStudio:3mfVersion', value: '1' },
        { name: 'slic3rpe:Version3mf', value: '1' },
        { name: 'slic3rpe:MmPaintingVersion', value: '1' }
    ];
    metadataToAdd.forEach(meta => {
        const metaElement = xmlDoc.createElementNS(xmlDoc.documentElement.namespaceURI, 'metadata');
        metaElement.setAttribute('name', meta.name);
        metaElement.textContent = meta.value;
        model.insertBefore(metaElement, model.firstChild);
    });

    // pid -> p -> extruder color index
    const resourceMap = new Map();
    Array.from(xmlDoc.getElementsByTagName('basematerials')).forEach(basematerials => {
        const id = Number(basematerials.getAttribute('id'));
        resourceMap.set(id, Array.from(basematerials.getElementsByTagName('base')).map((base, index) => {
            const colorString = base.getAttribute('displaycolor')!;
            if (!colorString.startsWith('#')) throw new Error('Invalid color format: ' + colorString);
            const [r, g, b] = colorString.substring(1).match(/\w\w/g)!.map(hex => parseInt(hex, 16));
            const lab = rgbToLab({r, g, b});
            const closestColorIndex = findClosestColor(lab, labColors);
            return closestColorIndex;
            // const lab = rgbToLab(hexToRgb(colorString));
            // return findClosestColor(lab, labColors);
        }));
    });

    // Reverse-engineered from PrusaSlicer / BambuStudio's output.
    const paintColorMap = ['', '8', '0C', '1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'AC', 'BC', 'CC', 'DC'];

    Array.from(xmlDoc.getElementsByTagName('object')).forEach(object => {
        const object_pid = object.getAttribute('pid');
        const object_pindex = object.getAttribute('pindex');
        Array.from(object.getElementsByTagName('triangle')).forEach(triangle => {    
            let pid:any = triangle.getAttribute('pid') ?? object_pid;
            let p1:any = triangle.getAttribute('p1') ?? object_pindex;
            if (pid == null || p1 == null) return;

            pid = Number(pid);
            p1 = Number(p1);

            const res = resourceMap.get(pid);
            const extruderIndex = res[p1];
            // const extruderIndex = resourceMap.get(pid)[p1];
            if (extruderIndex == null) throw new Error('Extruder index not found for pid=' + pid + ', p1=' + p1 + " (resourceMap=" + resourceMap + ")");
            const paint_color = paintColorMap[extruderIndex];
            if (paint_color != '') {
                triangle.setAttribute('paint_color', paint_color);
            }
        });
    });

    const xmlOutput = new XMLSerializer().serializeToString(xmlDoc);
    // contents.file(modelFile.name, xmlOutput);
    contents[modelFile] = new TextEncoder().encode(xmlOutput);
    // const modifiedContent = await zip.generateAsync({type: 'blob'});
    const modifiedContent = UZIP.encode(contents);
    
    return new File([modifiedContent], file.name, {type: 'model/3mf'});
}