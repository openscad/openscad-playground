import { showDirectoryPicker, showOpenFilePicker } from 'file-system-access';
import TreeNode from 'primereact/treenode';
import { Dispatch, SetStateAction } from 'react';

export interface FileSystemContextInterface {
    fileSystem: BaseFileSystem
    setFileSystem: Dispatch<SetStateAction<BaseFileSystem>>
}

export abstract class BaseFileSystem {
    abstract initialise(): Promise<any>;
    abstract getFiles(): Promise<TreeNode[]>;
    abstract readFile(path: string): Promise<string>;
    abstract createFile(name: string): Promise<any>;
    abstract saveFile(name: string, content: string): Promise<any>;
}

export class DummyFileSystem implements BaseFileSystem {
    async initialise(): Promise<any> {
        return null;
    }
    async getFiles(): Promise<TreeNode[]> {
        return [];
    }

    async readFile(path: string): Promise<string> {
        return ""
    }

    async createFile(name: string): Promise<any> {

    }

    async saveFile(name: string, content: string): Promise<any> {

    }

}

export class LocalFileSystem implements BaseFileSystem {
    dirHandle!: FileSystemDirectoryHandle;

    constructor() {

    }
    async initialise(): Promise<any> {
        this.dirHandle = await showDirectoryPicker();
    }

    async getFiles(): Promise<TreeNode[]> {
        let result = [];
        for await (const entry of this.dirHandle.values()) {
            console.log(entry.kind, entry.name);
            result.push({
                label: entry.name,
                key: entry.name
            });
        }
        return result;
    }

    async readFile(path: string): Promise<string> {
        return await (await (await this.dirHandle.getFileHandle(path)).getFile()).text()
    }

    async createFile(name: string) {
        let file = await (await this.dirHandle.getFileHandle(name, { create: true })).createWritable();
        await file.write("");
        await file.close()
    }

    async saveFile(name: string, content: string): Promise<any> {
        let file = await (await this.dirHandle.getFileHandle(name)).createWritable();
        await file.write(content);
        await file.close()
    }
}