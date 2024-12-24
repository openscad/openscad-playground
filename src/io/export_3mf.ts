import UZIP from "uzip";
import { IndexedPolyhedron } from "./common";
import { v4 as uuidv4 } from "uuid";
import chroma from "chroma-js";

function getColorMapping(colors: chroma.Color[], projectedColors: chroma.Color[]): number[] {
    const projectedLabs = projectedColors.map(c => c.lab());

    return colors.map((targetColor, i) => {
        const targetLab = targetColor.lab();

        let closestIndex = 0;
        let minDelta = Infinity;
        projectedLabs.forEach((projectedLab, index) => {
            const deltaL = targetLab[0] - projectedLab[0];
            const deltaA = targetLab[1] - projectedLab[1];
            const deltaB = targetLab[2] - projectedLab[2];
            const d = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
            if (d < minDelta) {
                minDelta = d;
                closestIndex = index;
            }
        });
        return closestIndex;
    });
}

// Reverse-engineered from PrusaSlicer / BambuStudio's output.
const PAINT_COLOR_MAP = ['', '8', '0C', '1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'AC', 'BC', 'CC', 'DC'];

export function export3MF(data: IndexedPolyhedron, extruderColors?: chroma.Color[]): Blob {
    const objectUuid = uuidv4();
    const buildUuid = uuidv4();

    const dataColors = data.colors.map(([r, g, b, a]) => chroma.rgb(r*255, g*255, b*255, a*255));
    const extruderIndexByColorIndex = extruderColors &&
        getColorMapping(dataColors, extruderColors);

    if (extruderColors) {
        console.log('Extruder colors:');
        for (const c of extruderColors) {
            console.log(`- ${c.name()}`);
        }
        console.log('Model color mapping:');
        dataColors.forEach((from, i) => {
            const extruderIndex = extruderIndexByColorIndex![i];
            const to = extruderColors[extruderIndex];
            console.log(`- ${from.name()} -> ${to?.name()} (${PAINT_COLOR_MAP[extruderIndex]})`);
        });
    }

    const paintColorByColorIndex = extruderIndexByColorIndex?.map(i => PAINT_COLOR_MAP[i]);
    
    const archive = {
        '3D/3dmodel.model': new TextEncoder().encode([
            '<?xml version="1.0" encoding="utf-8"?>',
            '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">',
                '<meta name="BambuStudio:3mfVersion" value="1"/>',
                '<meta name="slic3rpe:Version3mf" value="1"/>',
                '<meta name="slic3rpe:MmPaintingVersion" value="1"/>',
                '<resources>',
                    '<basematerials id="2">',
                    ...data.colors.map((color, i) => `<base name="color_${i}" displaycolor="${chroma.rgb(...color).hex()}"/>`),
                    '</basematerials>',
                    `<object id="1" name="OpenSCAD Model" type="model" p:UUID="${objectUuid}" pid="2" pindex="0">`,
                        '<mesh>',
                            '<vertices>',
                                ...data.vertices.map((vertex, i) => `<vertex x="${vertex.x}" y="${vertex.y}" z="${vertex.z}" />`),
                            '</vertices>',
                            '<triangles>',
                                ...data.faces.map((face, i) => {
                                    const { vertices, colorIndex } = face;
                                    if (vertices.length != 3) throw new Error('Face must have 3 vertices');
                                    const attrs = vertices.map((v, i) => `v${i + 1}="${v}"`);
                                    if (colorIndex > 0) {
                                        attrs.push(`pid="2" p1="${colorIndex}"`);
                                    }
                                    const paintColor = paintColorByColorIndex && paintColorByColorIndex[colorIndex];
                                    if (paintColor) {
                                        attrs.push(`paint_color="${paintColor}"`);
                                    }
                                    return `<triangle ${attrs.join(' ')} />`;
                                }),
                            '</triangles>',
                        '</mesh>',
                    '</object>',
                '</resources>',
                `<build p:UUID="${buildUuid}}">`,
                    `<item objectid="1" p:UUID="${objectUuid}"/>`,
                '</build>',
            '</model>',
        ].join('\n')),
        '[Content_Types].xml': new TextEncoder().encode([
            '<?xml version="1.0" encoding="utf-8"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
                '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
            '</Types>',
        ].join('\n')),
        '_rels/.rels': new TextEncoder().encode([
            '<?xml version="1.0" encoding="utf-8"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>',
            '</Relationships>',
        ].join('\n')),
    };
    return new Blob([UZIP.encode(archive)], {type: 'model/3mf'});
}

