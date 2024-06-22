import JSZip from "jszip";
import { RGBColor, findClosestColor, hexToRgb, rgbToLab } from "./colors";

export async function materialize3MFFile(file: File, extruderRGBColors: RGBColor[]): Promise<File> {
  if (extruderRGBColors.length === 0) {
    throw new Error('Please provide extruder colors.');
  }
  const labColors = extruderRGBColors.map(rgb => rgbToLab(rgb));

    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const modelFile = contents.file(/.*\.model$/)[0];
    if (!modelFile) {
        throw new Error('No .model file found in the 3MF package.');
    }

    const xmlInput = await modelFile.async('text');
    const xmlDoc = new DOMParser().parseFromString(xmlInput, 'application/xml');

    const model = xmlDoc.querySelector('model');
    const metadataToAdd = [
        { name: 'BambuStudio:3mfVersion', value: '1' },
        { name: 'slic3rpe:Version3mf', value: '1' },
        { name: 'slic3rpe:MmPaintingVersion', value: '1' }
    ];

    // pid -> p -> extruder color index
    const resourceMap = new Map();
    Array.from(xmlDoc.getElementsByTagName('basematerials')).forEach(basematerials => {
        const id = Number(basematerials.getAttribute('id'));
        resourceMap.set(id, Array.from(basematerials.getElementsByTagName('base')).map((base, index) => {
            const colorString = base.getAttribute('displaycolor')!;
            const lab = rgbToLab(hexToRgb(colorString));
            return findClosestColor(lab, labColors);
        }));
    });

    // Reverse-engineered from PrusaSlicer / BambuStudio's output.
    const paintColorMap = ['', '8', '0C', '1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'AC', 'BC', 'CC', 'DC'];

    Array.from(xmlDoc.getElementsByTagName('object')).forEach(object => {
        const object_pid = object.getAttribute('pid');
        const object_pindex = object.getAttribute('pindex');
        Array.from(object.getElementsByTagName('triangle')).forEach(triangle => {    
            const pid = triangle.getAttribute('pid') ?? object_pid;
            const p1 = triangle.getAttribute('p1') ?? object_pindex;
            if (pid == null || p1 == null) return;

            const extruderIndex = resourceMap.get(pid)[p1];
            if (extruderIndex == null) throw new Error('Extruder index not found for pid=' + pid + ', p1=' + p1 + " (resourceMap=" + resourceMap + ")");
            const paint_color = paintColorMap[extruderIndex];
            if (paint_color != '') {
                triangle.setAttribute('paint_color', paint_color);
            }
        });
    });

    const xmlOutput = new XMLSerializer().serializeToString(xmlDoc);
    contents.file(modelFile.name, xmlOutput);
    const modifiedContent = await zip.generateAsync({type: 'blob'});
    
    return new File([modifiedContent], file.name, {type: 'model/3mf'});
}