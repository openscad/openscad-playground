#!/usr/bin/env node

import { exec } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

class OpenSCADLibrariesPlugin {
    constructor(options = {}) {
        this.configFile = options.configFile || 'libs-config.json';
        this.libsDir = options.libsDir || 'libs';
        this.publicLibsDir = options.publicLibsDir || 'public/libraries';
        this.srcWasmDir = options.srcWasmDir || 'src/wasm';
        this.buildMode = options.buildMode || 'all'; // 'all', 'wasm', 'fonts', 'libs'
        this.config = null;
    }

    apply(compiler) {
        const pluginName = 'OpenSCADLibrariesPlugin';

        compiler.hooks.beforeRun.tapAsync(pluginName, async (_, callback) => {
            try {
                await this.loadConfig();

                switch (this.buildMode) {
                    case 'all':
                        await this.buildAll();
                        break;
                    case 'wasm':
                        await this.buildWasm();
                        break;
                    case 'fonts':
                        await this.buildFonts();
                        break;
                    case 'libs':
                        await this.buildAllLibraries();
                        break;
                    case 'clean':
                        await this.clean();
                        break;
                }

                callback();
            } catch (error) {
                callback(error);
            }
        });
    }

    async loadConfig() {
        try {
            const configContent = await fs.readFile(this.configFile, 'utf-8');
            this.config = JSON.parse(configContent);
        } catch (error) {
            throw new Error(`Failed to load config from ${this.configFile}: ${error.message}`);
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

        try {
            await fs.rm(outputPath, { force: true });
        } catch { /* ignore */ }

        const fullSourceDir = path.join(sourceDir, workingDir);

        // Build find command for includes
        let findCmd = '';
        if (includes.length > 0) {
            const findPatterns = includes.map(pattern => {
                if (pattern.includes('**/*.')) {
                    const parts = pattern.split('/');
                    const dir = parts[0];
                    const filePattern = parts[parts.length - 1];
                    return `-path "./${dir}/*" -name "${filePattern}"`;
                } else if (pattern.includes('**')) {
                    const filePattern = pattern.replace('**/', '');
                    return `-name "${filePattern}"`;
                } else if (pattern.includes('*')) {
                    return `-name "${pattern}"`;
                } else if (pattern.includes('/')) {
                    return `-path "./${pattern}"`;
                } else {
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

        await this.ensureDir(this.libsDir);

        if (!existsSync(wasmDir)) {
            await this.ensureDir(wasmDir);
            await this.downloadFile(wasmBuild.url, wasmZip);

            console.log(`Extracting WASM to ${wasmDir}`);
            await execAsync(`cd ${wasmDir} && unzip ../${path.basename(wasmZip)}`);
        }

        await this.ensureDir('public');

        const jsTarget = 'public/openscad.js';
        const wasmTarget = 'public/openscad.wasm';

        // Remove existing symlinks/files
        try {
            await fs.unlink(jsTarget);
        } catch { /* ignore */ }
        try {
            await fs.unlink(wasmTarget);
        } catch { /* ignore */ }

        // Create new symlinks
        await fs.symlink(path.relative('public', path.join(wasmDir, 'openscad.js')), jsTarget);
        await fs.symlink(path.relative('public', path.join(wasmDir, 'openscad.wasm')), wasmTarget);

        // Create src/wasm symlink
        try {
            await fs.unlink(this.srcWasmDir);
        } catch { /* ignore */ }
        await fs.symlink(path.relative('src', wasmDir), this.srcWasmDir);

        console.log('WASM setup completed');
    }

    async buildFonts() {
        const { fonts } = this.config;
        const notoDir = path.join(this.libsDir, 'noto');
        const liberationDir = path.join(this.libsDir, 'liberation');

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
        const fontsZip = path.join(this.publicLibsDir, 'fonts.zip');
        await this.ensureDir(this.publicLibsDir);

        console.log('Creating fonts.zip');
        const fontsCmd = `zip -r ${fontsZip} -j fonts.conf libs/noto/*.ttf libs/liberation/*.ttf libs/liberation/LICENSE libs/liberation/AUTHORS`;
        await execAsync(fontsCmd);

        console.log('Fonts setup completed');
    }

    async buildLibrary(library) {
        const zipPath = path.join(this.publicLibsDir, `${library.name}.zip`);

        if (library.localPath) {
            const sourceRoot = path.resolve(library.localPath);
            const workingDir = library.workingDir || '.';
            const cwd = path.join(sourceRoot, workingDir);

            if (!existsSync(cwd)) {
                throw new Error(`Local library path not found: ${cwd}`);
            }

            await this.ensureDir(this.publicLibsDir);
            try {
                await fs.rm(zipPath, { force: true });
            } catch { /* ignore */ }

            const includes = library.zipIncludes?.length ? library.zipIncludes : ['.'];
            const includeArgs = includes.map(pattern => JSON.stringify(pattern)).join(' ');
            const excludeArgs = (library.zipExcludes || []).map(pattern => `-x ${JSON.stringify(pattern)}`).join(' ');
            const zipCmd = `cd ${JSON.stringify(cwd)} && zip -r ${JSON.stringify(path.resolve(zipPath))} ${includeArgs}${excludeArgs ? ` ${excludeArgs}` : ''}`;

            console.log(`Creating local zip ${zipPath}`);
            try {
                await execAsync(zipCmd);
            } catch (error) {
                console.error(`Failed to create local zip ${zipPath}:`, error.message);
                throw error;
            }
            return;
        }

        const libDir = path.join(this.libsDir, library.name);

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
        await this.ensureDir(this.publicLibsDir);

        for (const library of this.config.libraries) {
            await this.buildLibrary(library);
        }
    }

    async clean() {
        console.log('Cleaning build artifacts...');

        const cleanPaths = [
            this.libsDir,
            'build',
            'public/openscad.js',
            'public/openscad.wasm',
            `${this.publicLibsDir}/*.zip`,
            this.srcWasmDir
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

    async buildAll() {
        console.log('Building all libraries...');

        await this.buildWasm();
        await this.buildFonts();
        await this.buildAllLibraries();

        console.log('Build completed successfully!');
    }
}

export default OpenSCADLibrariesPlugin;
