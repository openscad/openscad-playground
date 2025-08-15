#!/usr/bin/env node

import fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

const CONFIG_FILE = 'libs-config.json';
const LIBS_DIR = 'libs';
const PUBLIC_LIBS_DIR = 'public/libraries';
const SRC_WASM_DIR = 'src/wasm';

class LibsBuilder {
    constructor() {
        this.config = null;
    }

    async loadConfig() {
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
            this.config = JSON.parse(configContent);
        } catch (error) {
            console.error(`Failed to load config from ${CONFIG_FILE}:`, error.message);
            process.exit(1);
        }
    }

    async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    async downloadFile(url, outputPath) {
        console.log(`Downloading ${url} to ${outputPath}`);

        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirects
                    return this.downloadFile(response.headers.location, outputPath)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                const fileStream = createWriteStream(outputPath);
                pipeline(response, fileStream)
                    .then(resolve)
                    .catch(reject);
            }).on('error', reject);
        });
    }

    async cloneRepo(repo, targetDir, branch = 'master', shallow = true) {
        const cloneArgs = [
            'clone',
            '--recurse',
            shallow ? '--depth 1' : '',
            `--branch ${branch}`,
            '--single-branch',
            repo,
            targetDir
        ].filter(Boolean);

        console.log(`Cloning ${repo} to ${targetDir}`);
        try {
            await execAsync(`git ${cloneArgs.join(' ')}`);
        } catch (error) {
            console.error(`Failed to clone ${repo}:`, error.message);
            throw error;
        }
    }

    async createZip(sourceDir, outputPath, includes = [], excludes = [], workingDir = '.') {
        await this.ensureDir(path.dirname(outputPath));

        const fullSourceDir = path.join(sourceDir, workingDir);

        // Build find command for includes
        let findCmd = '';
        if (includes.length > 0) {
            const findPatterns = includes.map(pattern => {
                if (pattern.includes('**/*.')) {
                    // Pattern like "examples/**/*.scad"
                    const parts = pattern.split('/');
                    const dir = parts[0];
                    const filePattern = parts[parts.length - 1];
                    return `-path "./${dir}/*" -name "${filePattern}"`;
                } else if (pattern.includes('**')) {
                    // Pattern like "**/*.scad"
                    const filePattern = pattern.replace('**/', '');
                    return `-name "${filePattern}"`;
                } else if (pattern.includes('*')) {
                    // Pattern like "*.scad"
                    return `-name "${pattern}"`;
                } else if (pattern.includes('/')) {
                    // Path pattern like "bitmap/*.scad"
                    return `-path "./${pattern}"`;
                } else {
                    // Direct file/directory name
                    return `-name "${pattern}" -o -path "./${pattern}/*"`;
                }
            }).join(' -o ');
            findCmd = `find . \\( ${findPatterns} \\)`;
        } else {
            findCmd = 'find . -name "*.scad"';
        }

        // Add excludes
        if (excludes.length > 0) {
            const excludePatterns = excludes.map(pattern => {
                const cleanPattern = pattern.replace('**/', '').replace('/**', '');
                return `-not -path "*/${cleanPattern}*"`;
            }).join(' ');
            findCmd += ` ${excludePatterns}`;
        }

        const zipCmd = `cd ${fullSourceDir} && ${findCmd} | zip -r ${path.resolve(outputPath)} -@`;

        console.log(`Creating zip: ${outputPath}`);
        console.log(`Zip command: ${zipCmd}`);
        try {
            await execAsync(zipCmd);
        } catch (error) {
            console.error(`Failed to create zip ${outputPath}:`, error.message);
            throw error;
        }
    }

    async buildWasm() {
        const { wasmBuild } = this.config;
        const wasmDir = wasmBuild.target;
        const wasmZip = `${wasmDir}.zip`;

        // Create libs directory
        await this.ensureDir(LIBS_DIR);

        // Download WASM if not exists
        if (!existsSync(wasmDir)) {
            await this.ensureDir(wasmDir);

            // Download WASM zip
            await this.downloadFile(wasmBuild.url, wasmZip);

            // Extract WASM zip
            console.log(`Extracting WASM to ${wasmDir}`);
            await execAsync(`cd ${wasmDir} && unzip ../${path.basename(wasmZip)}`);
        }

        // Create symlinks for public files
        await this.ensureDir('public');

        const jsTarget = 'public/openscad.js';
        const wasmTarget = 'public/openscad.wasm';

        // Remove existing symlinks/files
        try {
            await fs.unlink(jsTarget);
        } catch {
            // ignore - file doesn't exist
        }
        try {
            await fs.unlink(wasmTarget);
        } catch {
            // ignore - file doesn't exist
        }

        // Create new symlinks - use relative paths for portability
        await fs.symlink(path.relative('public', path.join(wasmDir, 'openscad.js')), jsTarget);
        await fs.symlink(path.relative('public', path.join(wasmDir, 'openscad.wasm')), wasmTarget);

        // Create src/wasm symlink
        try {
            await fs.unlink(SRC_WASM_DIR);
        } catch {
            // ignore - file doesn't exist
        }
        await fs.symlink(path.relative('src', wasmDir), SRC_WASM_DIR);

        console.log('WASM setup completed');
    }

    async buildFonts() {
        const { fonts } = this.config;
        const notoDir = path.join(LIBS_DIR, 'noto');
        const liberationDir = path.join(LIBS_DIR, 'liberation');

        await this.ensureDir(notoDir);

        // Download Noto fonts
        for (const font of fonts.notoFonts) {
            const fontPath = path.join(notoDir, font);
            if (!existsSync(fontPath)) {
                const url = fonts.notoBaseUrl + font;
                await this.downloadFile(url, fontPath);
            }
        }

        // Clone liberation fonts if not exists
        if (!existsSync(liberationDir)) {
            await this.cloneRepo(fonts.liberationRepo, liberationDir, fonts.liberationBranch);
        }

        // Create fonts zip
        const fontsZip = path.join(PUBLIC_LIBS_DIR, 'fonts.zip');
        await this.ensureDir(PUBLIC_LIBS_DIR);

        console.log('Creating fonts.zip');
        const fontsCmd = `zip -r ${fontsZip} -j fonts.conf libs/noto/*.ttf libs/liberation/*.ttf libs/liberation/LICENSE libs/liberation/AUTHORS`;
        await execAsync(fontsCmd);

        console.log('Fonts setup completed');
    }

    async buildLibrary(library) {
        const libDir = path.join(LIBS_DIR, library.name);
        const zipPath = path.join(PUBLIC_LIBS_DIR, `${library.name}.zip`);

        // Clone repository if not exists
        if (!existsSync(libDir)) {
            await this.cloneRepo(library.repo, libDir, library.branch);
        }

        // Create zip
        await this.createZip(
            libDir,
            zipPath,
            library.zipIncludes || ['*.scad'],
            library.zipExcludes || [],
            library.workingDir || '.'
        );

        console.log(`Built ${library.name}`);
    }

    async buildAllLibraries() {
        await this.ensureDir(PUBLIC_LIBS_DIR);

        for (const library of this.config.libraries) {
            await this.buildLibrary(library);
        }
    }

    async clean() {
        console.log('Cleaning build artifacts...');

        const cleanPaths = [
            LIBS_DIR,
            'build',
            'public/openscad.js',
            'public/openscad.wasm',
            `${PUBLIC_LIBS_DIR}/*.zip`,
            SRC_WASM_DIR
        ];

        for (const cleanPath of cleanPaths) {
            try {
                if (cleanPath.includes('*')) {
                    await execAsync(`rm -f ${cleanPath}`);
                } else {
                    await fs.rm(cleanPath, { recursive: true, force: true });
                }
            } catch {
                // Ignore errors for files that don't exist
            }
        }

        console.log('Clean completed');
    }

    async build() {
        console.log('Building all libraries...');

        await this.buildWasm();
        await this.buildFonts();
        await this.buildAllLibraries();

        console.log('Build completed successfully!');
    }
}

async function main() {
    const builder = new LibsBuilder();
    await builder.loadConfig();

    const command = process.argv[2] || 'build';

    switch (command) {
        case 'build':
            await builder.build();
            break;
        case 'clean':
            await builder.clean();
            break;
        case 'wasm':
            await builder.buildWasm();
            break;
        case 'fonts':
            await builder.buildFonts();
            break;
        default:
            console.log('Usage: node build-libs.js [build|clean|wasm|fonts]');
            process.exit(1);
    }
}

main().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
