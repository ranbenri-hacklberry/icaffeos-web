import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';

const KEY_ALGORITHM = 'aes-256-cbc';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// This should be provided securely. For demo, we might use a fixed key or env var.
const ENCRYPTION_KEY = process.env.MUSIC_ENCRYPTION_KEY || 'my-secret-key-must-be-32-bytes!!'; // 32 bytes
const IV_LENGTH = 16;

class DriveSync {
    constructor(serviceAccountPath, localMusicDir) {
        this.serviceAccountPath = serviceAccountPath;
        this.localMusicDir = localMusicDir;
        this.auth = null;
        this.drive = null;
    }

    async authenticate() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: this.serviceAccountPath,
            scopes: SCOPES,
        });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        console.log('✅ Google Drive authenticated');
    }

    async ensureLocalDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    async listFiles() {
        if (!this.drive) await this.authenticate();

        const res = await this.drive.files.list({
            pageSize: 1000,
            fields: 'files(id, name, parents, mimeType)',
        });
        return res.data.files;
    }

    async decryptFile(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const fileBuffer = fs.readFileSync(inputPath);

            // Extract IV
            const iv = fileBuffer.slice(0, IV_LENGTH);
            const encryptedContent = fileBuffer.slice(IV_LENGTH);

            const decipher = crypto.createDecipheriv(KEY_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

            let decrypted = decipher.update(encryptedContent);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            fs.writeFileSync(outputPath, decrypted);
            resolve(outputPath);
        });
    }

    async syncFile(fileId, fileName, relativePath) {
        if (!this.drive) await this.authenticate();

        const destDir = path.join(this.localMusicDir, path.dirname(relativePath));
        await this.ensureLocalDirectory(destDir);

        const tempEncPath = path.join(destDir, fileName); // e.g. song.mp3.enc
        const finalPath = path.join(destDir, fileName.replace('.enc', '')); // e.g. song.mp3

        console.log(`⬇️ Downloading ${fileName}...`);

        const dest = fs.createWriteStream(tempEncPath);

        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            res.data
                .on('end', async () => {
                    console.log(`🔓 Decrypting to ${finalPath}...`);
                    try {
                        await this.decryptFile(tempEncPath, finalPath);
                        fs.unlinkSync(tempEncPath); // Remove encrypted file
                        resolve(finalPath);
                    } catch (e) {
                        reject(e);
                    }
                })
                .on('error', err => reject(err))
                .pipe(dest);
        });
    }

    // Main sync function called by API
    async performSync() {
        console.log('🔄 Starting Drive Sync...');

        // 1. Find "Music Encrypted" root folder
        const allFiles = await this.listFiles();
        const rootFolder = allFiles.find(f => f.name === 'Music Encrypted' && f.mimeType === 'application/vnd.google-apps.folder');

        if (!rootFolder) {
            throw new Error('Folder "Music Encrypted" not found in Drive root.');
        }

        console.log('📂 Found root folder ID:', rootFolder.id);

        // 2. Build folder map to reconstruct paths
        const folderMap = new Map();
        allFiles.forEach(f => {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
                folderMap.set(f.id, f);
            }
        });

        const getRelativePath = (file) => {
            let pathParts = [];
            let current = file;

            while (current && current.parents && current.parents[0]) {
                const parentId = current.parents[0];
                if (parentId === rootFolder.id) break;

                const parent = folderMap.get(parentId);
                if (parent) {
                    pathParts.unshift(parent.name);
                    current = parent;
                } else {
                    break;
                }
            }
            return path.join(...pathParts, file.name);
        };

        // 3. Find and sync all .enc files
        const encFiles = allFiles.filter(f => f.name.endsWith('.enc'));
        const results = [];

        console.log(`🎵 Found ${encFiles.length} encrypted files to sync.`);

        for (const file of encFiles) {
            try {
                const relativePath = getRelativePath(file);
                const localPath = await this.syncFile(file.id, file.name, relativePath);
                results.push({ name: file.name, status: 'synced', path: localPath });
            } catch (err) {
                console.error(`❌ Failed to sync ${file.name}:`, err.message);
                results.push({ name: file.name, status: 'error', error: err.message });
            }
        }

        return {
            message: 'Sync completed',
            stats: {
                total: encFiles.length,
                synced: results.filter(r => r.status === 'synced').length,
                errors: results.filter(r => r.status === 'error').length
            },
            results
        };
    }
}

export default DriveSync;
