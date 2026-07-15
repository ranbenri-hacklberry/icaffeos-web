
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');
const SERVICE_ACCOUNT_PATH = path.join(ROOT_DIR, 'service-account.json');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Cache for auth client
let authClient = null;

const getAuthClient = async () => {
    if (authClient) return authClient;

    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: SCOPES,
    });
    authClient = await auth.getClient();
    return authClient;
};

/**
 * Find or create a specific folder in Drive
 */
const findOrCreateFolder = async (drive, folderName, parentId = null) => {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) {
        query += ` and '${parentId}' in parents`;
    }

    const res = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (res.data.files.length > 0) {
        return res.data.files[0].id;
    }

    // Create if not exists
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
    };

    const file = await drive.files.create({
        resource: fileMetadata,
        fields: 'id'
    });
    return file.data.id;
};

/**
 * Upload a JSON backup to Google Drive
 * @param {string} filePath - Absolute path to local backup file
 * @param {string} fileName - Name to save as in Drive
 * @param {string} businessId - To organize backups by business
 */
export const uploadBackupToDrive = async (filePath, fileName, businessId) => {
    try {
        const auth = await getAuthClient();
        const drive = google.drive({ version: 'v3', auth });

        // 1. Ensure "KDS_Backups" root folder exists
        const rootFolderId = await findOrCreateFolder(drive, 'KDS_Backups');

        // 2. Ensure Business Folder exists
        const businessFolderId = await findOrCreateFolder(drive, `Business_${businessId}`, rootFolderId);

        // 3. Upload File
        const fileMetadata = {
            name: fileName,
            parents: [businessFolderId]
        };
        const media = {
            mimeType: 'application/json',
            body: fs.createReadStream(filePath)
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, createdTime'
        });

        console.log(`✅ [Backup] Uploaded ${fileName} (ID: ${file.data.id})`);
        return { success: true, fileId: file.data.id, createdTime: file.data.createdTime };

    } catch (error) {
        console.error('❌ [Backup] Drive Upload Failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get last backup timestamp for a business
 */
export const getLastBackupTime = async (businessId) => {
    try {
        const auth = await getAuthClient();
        const drive = google.drive({ version: 'v3', auth });

        // Find folders
        const rootId = await findOrCreateFolder(drive, 'KDS_Backups');
        const bizId = await findOrCreateFolder(drive, `Business_${businessId}`, rootId);

        // List files in that folder, sorted by time desc
        const res = await drive.files.list({
            q: `'${bizId}' in parents and trashed=false`,
            orderBy: 'createdTime desc',
            pageSize: 1,
            fields: 'files(id, createdTime, name)'
        });

        if (res.data.files.length > 0) {
            return res.data.files[0].createdTime;
        }
        return null; // Never backed up

    } catch (error) {
        console.error('❌ Failed to check last backup:', error);
        return null;
    }
};
