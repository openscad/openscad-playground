import { Color, DEFAULT_FACE_COLOR, Face, IndexedPolyhedron, Vertex } from './common';

export function parseOff(content: string): IndexedPolyhedron {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
    
    if (lines.length === 0) throw new Error('Empty OFF file');

    let counts: string;
    let currentLine = 0;
    if (lines[0].match(/^OFF(\s|$)/)) {
        counts = lines[0].substring(3).trim();
        currentLine = 1;
    } else if (lines[currentLine] === 'OFF' && lines.length > 1) {
        counts = lines[1];
        currentLine = 2;
    } else {
        throw new Error('Invalid OFF file: missing OFF header');
    }

    const [numVertices, numFaces] = counts.split(/\s+/).map(Number);
    if (isNaN(numVertices) || isNaN(numFaces)) throw new Error('Invalid OFF file: invalid vertex or face counts');

    if (currentLine + numVertices + numFaces > lines.length) throw new Error('Invalid OFF file: not enough lines');

    const vertices: Vertex[] = [];
    for (let i = 0; i < numVertices; i++) {
        const parts = lines[currentLine + i].split(/\s+/).map(Number);
        if (parts.length < 3 || parts.some(isNaN)) throw new Error(`Invalid OFF file: invalid vertex at line ${currentLine + i + 1}`);
        vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
    }
    currentLine += numVertices;

    const colors: Color[] = [];
    const colorMap = new Map<string, number>();

    const faces: Face[] = [];
    for (let i = 0; i < numFaces; i++) {
        const parts = lines[currentLine + i].split(/\s+/).map(Number);
        const numVerts = parts[0];
        const vertices = parts.slice(1, numVerts + 1);
        const color = parts.length >= numVerts + 4
            ? parts.slice(numVerts + 1, numVerts + 5).map(c => c / 255) as [number, number, number, number]
            : DEFAULT_FACE_COLOR;
        if (vertices.length < 3) throw new Error(`Invalid OFF file: face at line ${currentLine + i + 1} must have at least 3 vertices`);

        const colorKey = color ? color.join(',') : '';
        let colorIndex = colorMap.get(colorKey);
        if (colorIndex == null) {
            colorIndex = colors.length;
            const [r, g, b, a] = color;
            colors.push([r, g, b, a ?? 1]);
            colorMap.set(colorKey, colorIndex);
        }

        if (vertices.length == 3) {
            faces.push({
                vertices: vertices as [number, number, number],
                colorIndex
            });
        } else {
            // Triangulate the face
            for (let j = 1; j < vertices.length - 1; j++) {
                faces.push({
                    vertices: [vertices[0], vertices[j], vertices[j + 1]],
                    colorIndex
                });
            }   
        }
    }

    return { vertices, faces, colors };
}
