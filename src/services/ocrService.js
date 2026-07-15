/**
 * OCR Service - Secure Backend Proxy
 * Routes OCR requests through the backend to keep API keys secure
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/**
 * Process an invoice image through the secure backend OCR endpoint
 * @param {string} base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns {Promise<Object>} OCR result with items, supplier, date, etc.
 */
export const processInvoiceOCR = async (fileOrBase64, businessId) => {
    try {
        console.log('🔄 Sending OCR request to backend...');

        let response;
        if (fileOrBase64 instanceof File) {
            console.log('📦 Using raw file upload FormData method to avoid OOM crashes...');
            const formData = new FormData();
            formData.append('invoice', fileOrBase64);
            if (businessId) {
                formData.append('businessId', businessId);
            }
            response = await fetch(`${BACKEND_URL}/api/ocr/process-upload`, {
                method: 'POST',
                body: formData,
            });
        } else {
            console.log('📝 Using legacy JSON base64 method...');
            response = await fetch(`${BACKEND_URL}/api/ocr/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ base64Image: fileOrBase64, businessId }),
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `OCR request failed with status ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'OCR processing failed');
        }

        console.log(`✅ OCR complete: ${result.items?.length || 0} items found`);
        return result;

    } catch (error) {
        console.error('🚨 OCR Service Error:', error);
        throw error;
    }
};

export default { processInvoiceOCR };
