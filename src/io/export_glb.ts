import { Document, NodeIO, Accessor, Primitive } from '@gltf-transform/core';
import { Light as LightDef, KHRLightsPunctual } from '@gltf-transform/extensions';
import { Vertex, Color, Face, IndexedPolyhedron, DEFAULT_FACE_COLOR } from './common';

type Geom = {
    positions: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
};

function createPrimitive(doc: Document, baseColorFactor: Color, {positions, indices, colors}: Geom): Primitive {
    const prim = doc.createPrimitive()
        .setMode(Primitive.Mode.TRIANGLES)
        .setMaterial(
            doc.createMaterial()
                .setDoubleSided(true)
                .setAlphaMode(baseColorFactor[3] < 1 ? 'BLEND' : 'OPAQUE')
                .setMetallicFactor(0.0)
                .setRoughnessFactor(0.8)
                .setBaseColorFactor(baseColorFactor))
        .setAttribute('POSITION',
            doc.createAccessor()
                .setType(Accessor.Type.VEC3)
                .setArray(positions))
        .setIndices(
            doc.createAccessor()
                .setType(Accessor.Type.SCALAR)
                .setArray(indices));
    if (colors) {
        prim.setAttribute('COLOR_0',
            doc.createAccessor()
                .setType(Accessor.Type.VEC3)
                .setArray(colors));
    }
    return prim;
}

function getGeom(data: IndexedPolyhedron): Geom {
    let positions = new Float32Array(data.vertices.length * 3);
    const indices = new Uint32Array(data.faces.length * 3);

    const addedVertices = new Map<number, number>();
    let verticesAdded = 0;
    const addVertex = (i: number) => {
        let index = addedVertices.get(i);
        if (index === undefined) {
            const offset = verticesAdded * 3;
            const vertex = data.vertices[i];
            positions[offset] = vertex.x;
            positions[offset + 1] = vertex.y;
            positions[offset + 2] = vertex.z;
            index = verticesAdded++;
            addedVertices.set(i, index);
        }
        return index;
    };

    data.faces.forEach((face, i) => {
        const { vertices } = face;
        if (vertices.length < 3) throw new Error('Face must have at least 3 vertices');

        const offset = i * 3;
        indices[offset] = addVertex(vertices[0]);
        indices[offset + 1] = addVertex(vertices[1]);
        indices[offset + 2] = addVertex(vertices[2]);
    });
    return {
        positions: positions.slice(0, verticesAdded * 3),
        indices
    };
}

export async function exportGlb(data: IndexedPolyhedron, defaultColor: Color = DEFAULT_FACE_COLOR): Promise<Blob> {
    const doc = new Document();
    const lightExt = doc.createExtension(KHRLightsPunctual);
    doc.createBuffer();

    const scene = doc.createScene()
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual',
                lightExt.createLight()
                    .setType(LightDef.Type.DIRECTIONAL)
                    .setIntensity(3.0)
                    .setColor([1.0, 1.0, 1.0]))
            .setRotation([-0.3250576, -0.3250576, 0, 0.8880739]))
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual',
                lightExt.createLight()
                    .setType(LightDef.Type.DIRECTIONAL)
                    .setIntensity(2.0)
                    .setColor([0.9, 0.9, 1.0]))
            .setRotation([0.6279631, 0.6279631, 0, 0.4597009]))
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual',
                lightExt.createLight()
                    .setType(LightDef.Type.DIRECTIONAL)
                    .setIntensity(1.0)
                    .setColor([1.0, 1.0, 1.0]))
            .setRotation([0.7071068, 0, 0, 0.7071068]))
        .addChild(doc.createNode()
            .setExtension('KHR_lights_punctual',
                lightExt.createLight()
                    .setType(LightDef.Type.DIRECTIONAL)
                    .setIntensity(0.5)
                    .setColor([0.8, 0.8, 0.8]))
            .setRotation([-0.7071068, 0, 0, 0.7071068]));

    const mesh = doc.createMesh();

    const facesByColor = new Map<number, Face[]>();
    data.faces.forEach(face => {
        let faces = facesByColor.get(face.colorIndex);
        if (!faces) facesByColor.set(face.colorIndex, faces = []);
        faces.push(face);
    });
    for (let [colorIndex, faces] of facesByColor.entries()) {
        let color = data.colors[colorIndex];
        mesh.addPrimitive(
            createPrimitive(doc, color, getGeom({ vertices: data.vertices, faces, colors: data.colors })));
    }
    scene.addChild(doc.createNode().setMesh(mesh));

    const glb = await new NodeIO().registerExtensions([KHRLightsPunctual]).writeBinary(doc);
    return new Blob([glb], { type: 'model/gltf-binary' });
}
