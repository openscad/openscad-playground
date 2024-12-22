import { Document, NodeIO, Accessor, Primitive } from '@gltf-transform/core';
import { Light as LightDef, KHRLightsPunctual } from '@gltf-transform/extensions';

interface Vertex {
    x: number;
    y: number;
    z: number;
}

interface Face {
    vertices: number[];
    color?: [number, number, number];
}

interface IndexedPolyhedron {
    vertices: Vertex[];
    faces: Face[];
}

export async function convertOffToGlb(data: IndexedPolyhedron): Promise<Blob> {
    // Note: GLTF doesn't seem to support per-face colors, so we duplicate vertices
    // and provide per-vertex colors (all the same for each face).
    const positions = new Float32Array(data.faces.length * 3 * 3);
    const colors = new Float32Array(data.faces.length * 3 * 3);
    const indices = new Uint32Array(data.faces.length * 3);

    data.faces.forEach((face, i) => {
        const { vertices, color } = face;
        if (vertices.length != 3) throw new Error('Face must have at 3 vertices');

        const faceColor = color ?? [1, 1, 1];
        
        const offset = i * 3;
        indices[offset] = offset;
        indices[offset + 1] = offset + 1;
        indices[offset + 2] = offset + 2;

        const voffset = offset * 3;
        for (let j = 0; j < 3; j++) {
            positions[voffset + j * 3] = data.vertices[vertices[j]].x;
            positions[voffset + j * 3 + 1] = data.vertices[vertices[j]].y;
            positions[voffset + j * 3 + 2] = data.vertices[vertices[j]].z;
            colors[voffset + j * 3] = faceColor[0];
            colors[voffset + j * 3 + 1] = faceColor[1];
            colors[voffset + j * 3 + 2] = faceColor[2];
        }
    });

    const doc = new Document();
    const lightExt = doc.createExtension(KHRLightsPunctual);
    const buffer = doc.createBuffer();
    doc.createScene()
        .addChild(doc.createNode().setMesh(
            doc.createMesh().addPrimitive(
                doc.createPrimitive()
                    .setMode(Primitive.Mode.TRIANGLES)
                    .setMaterial(
                        doc.createMaterial()
                            .setDoubleSided(true)
                            .setBaseColorFactor([1,1,1,1]))
                    .setAttribute('POSITION',
                        doc.createAccessor()
                            .setType(Accessor.Type.VEC3)
                            .setArray(positions)
                            .setBuffer(buffer))
                    .setIndices(
                        doc.createAccessor()
                            .setType(Accessor.Type.SCALAR)
                            .setArray(indices)
                            .setBuffer(buffer))
                    .setAttribute('COLOR_0',
                        doc.createAccessor()
                            .setType(Accessor.Type.VEC3)
                            .setArray(colors)
                            .setBuffer(buffer)))))
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual', lightExt
                .createLight()
                .setType(LightDef.Type.DIRECTIONAL)
                .setIntensity(8.0)
                .setColor([1.0, 1.0, 1.0]))
            .setRotation([-0.3250576, -0.3250576, 0, 0.8880739]))
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual', lightExt
                .createLight()
                .setType(LightDef.Type.DIRECTIONAL)
                .setIntensity(8.0)
                .setColor([1.0, 1.0, 1.0]))
            .setRotation([0.6279631, 0.6279631, 0, 0.4597009]));

    const glb = await new NodeIO().registerExtensions([KHRLightsPunctual]).writeBinary(doc);
    return new Blob([glb], { type: 'model/gltf-binary' });
}

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

    const faces: Face[] = [];
    for (let i = 0; i < numFaces; i++) {
        const parts = lines[currentLine + i].split(/\s+/).map(Number);
        const numVerts = parts[0];
        faces.push({
            vertices: parts.slice(1, numVerts + 1),
            color: parts.length >= numVerts + 4
                ? parts.slice(numVerts + 1, numVerts + 4).map(c => c / 255) as [number, number, number]
                : undefined
        });
    }

    return { vertices, faces };
}
