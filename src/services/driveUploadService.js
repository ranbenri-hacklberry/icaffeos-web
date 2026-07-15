/**
 * Google Drive Upload Service
 * Uploads scanned invoices to Google Drive for backup
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Uploads an invoice image to Google Drive
 * @param {File} file - The image file
 * @param {Object} ocrResult - OCR results from Grok
 * @param {string} businessId - Business identifier
 * @returns {Promise<Object>} - Upload result with file ID and link
 */
export const uploadInvoiceToDrive = async (file, ocrResult = null, businessId = null) => {
    try {
        console.log('📤 Uploading invoice to Google Drive...');

        const formData = new FormData();
        formData.append('invoice', file);
        if (ocrResult) {
            formData.append('ocrResults', JSON.stringify(ocrResult));
        }
        if (businessId) {
            formData.append('businessId', businessId);
        }

        const response = await fetch(`${API_BASE}/api/drive/upload-invoice`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }

        const result = await response.json();

        console.log('✅ Invoice uploaded to Drive:', result.file.name);
        console.log('📁 Folder:', result.folderPath);

        return {
            success: true,
            fileId: result.file.id,
            fileName: result.file.name,
            viewLink: result.file.viewLink,
            downloadLink: result.file.downloadLink,
            folderPath: result.folderPath,
            uploadedAt: result.uploadedAt,
            ocrFileId: result.ocrFile?.id
        };

    } catch (error) {
        console.error('❌ Failed to upload invoice:', error);
        throw new Error('Failed to backup invoice: ' + error.message);
    }
};

/**
 * List recent invoices from Drive
 * @param {number} limit - Max number of files to return
 * @param {string} date - Optional date filter (YYYY-MM-DD)
 */
export const listInvoices = async (limit = 50, date = null) => {
    try {
        const params = new URLSearchParams({ limit: limit.toString() });
        if (date) params.append('date', date);

        const response = await fetch(`${API_BASE}/api/drive/invoices/list?${params}`);

        if (!response.ok) {
            throw new Error('Failed to list invoices');
        }

        const result = await response.json();
        return result.files;

    } catch (error) {
        console.error('❌ Failed to list invoices:', error);
        throw error;
    }
};

export default {
    uploadInvoiceToDrive,
    listInvoices
};
