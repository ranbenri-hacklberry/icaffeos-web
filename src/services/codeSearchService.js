/**
 * Maya Code Search - Using Google Gemini Embeddings
 * This function searches the indexed codebase using semantic search
 * Works on both localhost AND production
 */

const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

/**
 * Get embedding for a search query using Google Gemini API
 * Returns 768-dimension embedding (matches our Supabase code_chunks)
 */
export async function getQueryEmbedding(query) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('🌸 Code search: No Gemini API key found');
        return null;
    }

    try {
        console.log('🔍 Maya RAG: Getting embedding from Gemini...');

        const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                    parts: [{ text: query }]
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini Embedding error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        const embedding = data.embedding?.values;

        if (embedding) {
            console.log('✅ Maya RAG: Got Gemini embedding (', embedding.length, 'dimensions)');
        }

        return embedding || null;
    } catch (e) {
        console.error('❌ Gemini Embedding fetch error:', e.message);
        return null;
    }
}

/**
 * Search code chunks using the embedding and Supabase vector search
 * @param {object} supabase - Supabase client
 * @param {string} query - The search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of matching code chunks
 */
export async function searchCode(supabase, query, limit = 5) {
    // 1. Get embedding for the query
    const embedding = await getQueryEmbedding(query);

    if (!embedding) {
        console.warn('🌸 Maya RAG: No embedding available, skipping code search');
        return [];
    }

    // 2. Search in Supabase using the RPC
    try {
        console.log('🔍 Maya RAG: Searching with vector similarity...');

        const { data, error } = await supabase.rpc('search_code', {
            query_embedding: embedding,
            match_threshold: 0.3, // Lower threshold for more results
            match_count: limit
        });

        if (error) {
            console.error('❌ Code search RPC error:', error);
            return [];
        }

        console.log('✅ Maya RAG: Found', data?.length || 0, 'matching code chunks');
        return data || [];
    } catch (e) {
        console.error('❌ Code search exception:', e);
        return [];
    }
}

/**
 * Format search results for Maya's context
 */
export function formatCodeContext(results) {
    if (!results || results.length === 0) {
        return '';
    }

    return results.map((r, i) =>
        `**[${i + 1}] ${r.file_path}** (similarity: ${(r.similarity * 100).toFixed(0)}%)\n\`\`\`\n${r.content}\n\`\`\``
    ).join('\n\n');
}
