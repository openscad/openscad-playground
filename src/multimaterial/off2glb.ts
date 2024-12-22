import { Document, NodeIO, Accessor, Primitive } from '@gltf-transform/core';
import { Light as LightDef, KHRLightsPunctual } from '@gltf-transform/extensions';

type Vertex = {
    x: number;
    y: number;
    z: number;
}

type SolidColor = [number, number, number];

type Face = {
    vertices: number[];
    color?: SolidColor;
}

type IndexedPolyhedron = {
    vertices: Vertex[];
    faces: Face[];
}

const DEFAULT_FACE_COLOR: SolidColor = [0xf9 / 255, 0xd7 / 255, 0x2c / 255];

export async function convertOffToGlb(data: IndexedPolyhedron, defaultColor: SolidColor = DEFAULT_FACE_COLOR): Promise<Blob> {
    // Note: GLTF doesn't seem to support per-face colors, so we duplicate vertices
    // and provide per-vertex colors (all the same for each face).

    const numVertices = data.faces.reduce((acc, face) => acc + face.vertices.length, 0);
    const positions = new Float32Array(numVertices * 3);
    const colors = new Float32Array(numVertices * 3);
    const indices = new Uint32Array(numVertices);

    let verticesAdded = 0;
    const addVertex = (vertex: Vertex, color: [number, number, number]) => {
        const offset = verticesAdded * 3;
        positions[offset] = vertex.x;
        positions[offset + 1] = vertex.y;
        positions[offset + 2] = vertex.z;
        colors[offset] = color[0];
        colors[offset + 1] = color[1];
        colors[offset + 2] = color[2];
        return verticesAdded++;
    };

    data.faces.forEach((face, i) => {
        const { vertices, color } = face;
        if (vertices.length < 3) throw new Error('Face must have at least 3 vertices');

        const faceColor = color ?? defaultColor;
        
        const offset = i * 3;
        indices[offset] = addVertex(data.vertices[vertices[0]], faceColor);
        indices[offset + 1] = addVertex(data.vertices[vertices[1]], faceColor);
        indices[offset + 2] = addVertex(data.vertices[vertices[2]], faceColor);
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
        const vertices = parts.slice(1, numVerts + 1);
        const color = parts.length >= numVerts + 4
            ? parts.slice(numVerts + 1, numVerts + 4).map(c => c / 255) as [number, number, number]
            : undefined;
        if (vertices.length < 3) throw new Error(`Invalid OFF file: face at line ${currentLine + i + 1} must have at least 3 vertices`);
        else if (vertices.length == 3) {
            faces.push({ vertices, color });
        } else {
            // Triangulate the face
            for (let j = 1; j < vertices.length - 1; j++) {
                faces.push({ vertices: [vertices[0], vertices[j], vertices[j + 1]], color });
            }   
        }
    }

    return { vertices, faces };
}