import { useState } from 'react';
import { compressAndToBase64, fileToBase64 } from '@/utils/imageUtils';
import { processInvoiceOCR } from '@/services/ocrService';

export const useInvoiceOCR = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<any>(null);

    const scanInvoice = async (file: File, businessId?: string) => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);
        setOcrResult(null);

        try {
            const result = await processInvoiceOCR(file, businessId);
            setOcrResult(result);
            return result;
        } catch (err: any) {
            console.error('OCR Error:', err);
            setError(err.message || 'שגיאה בעיבוד החשבונית');
        } finally {
            setIsProcessing(false);
        }
    };

    return { scanInvoice, isProcessing, error, ocrResult, resetOCR: () => setOcrResult(null) };
};
