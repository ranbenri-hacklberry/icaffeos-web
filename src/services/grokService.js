/**
 * Grok Service for OCR tasks using grok-vision-beta
 */

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;

const SUPPLIERS_LIST = [
    { id: 1, name: 'ביסקוטי' },
    { id: 2, name: 'כוכב השחר' },
    { id: 3, name: 'פיצה מרקט' },
    { id: 5, name: 'ברכת האדמה' },
    { id: 6, name: 'תנובה' }
];

/**
 * Processes an invoice image with Grok Vision API.
 * @param {string} imageBase64 - The base64 string of the image (including data:image/jpeg;base64,...).
 * @returns {Promise<Object>} - The structured JSON output from Grok.
 */
export const processInvoiceWithGrok = async (imageBase64) => {
    if (!GROK_API_KEY) {
        throw new Error('Grok API Key is missing. Please set VITE_GROK_API_KEY in your environment.');
    }

    // Remove data:image/jpeg;base64, prefix if present for the message content but keep it if API needs it
    // Grok/OpenAI vision usually expects the full data URI or just the base64. 
    // Most common is the full data URI in the image_url field.

    const prompt = `Analyze the attached invoice image and extract all items into a JSON array.
For each item, provide the following fields:
- name: The item name in Hebrew as it appears on the invoice.
- category: A likely category for this item (e.g., חלבי, ירקות, מאפים).
- unit: The unit of measurement (e.g., יח', ק"ג, ליטר, חבילה).
- current_stock_added: The actual quantity of this item received in this invoice.
- cost_per_unit: The base price per single unit (before VAT).
- supplier_id: Match the supplier from this list: ${SUPPLIERS_LIST.map(s => `${s.name} (${s.id})`).join(', ')}. Return only the ID.
- case_quantity: Number of individual units per case (if it's a bulk pack), otherwise 1.
- multiplier_medium: A conversion multiplier if needed, otherwise 1.

Return ONLY a valid JSON object in the following format:
{
  "supplier_detected": "Name of supplier found on invoice",
  "supplier_id": ID_FROM_LIST_OR_NULL,
  "invoice_number": "number",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "...", "category": "...", "unit": "...", "current_stock_added": 0, "cost_per_unit": 0, "supplier_id": 0, "case_quantity": 1, "multiplier_medium": 1 }
  ]
}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for OCR

        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'grok-2-vision-1212',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageBase64,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                temperature: 0,
                response_format: { type: 'json_object' }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Grok API Error: ${errorData.error?.message || response.statusText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content;

        if (!content) {
            throw new Error('Grok returned an empty response.');
        }

        // 🔧 Clean up markdown code blocks if present (Grok sometimes wraps JSON in ```json ... ```)
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```')) {
            // Remove markdown code blocks
            cleanedContent = cleanedContent
                .replace(/^```json\s*/i, '')  // Remove opening ```json
                .replace(/^```\s*/i, '')       // Remove opening ``` (if no json)
                .replace(/\s*```$/, '');       // Remove closing ```
        }

        const parsed = JSON.parse(cleanedContent);

        // Validate matching or provide defaults if missing
        if (!parsed.items || !Array.isArray(parsed.items)) {
            parsed.items = [];
        }

        return parsed;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('OCR process timed out. The image might be too large or the connection is too slow.');
        }
        console.error('Error in processInvoiceWithGrok:', error);
        throw error;
    }
};
