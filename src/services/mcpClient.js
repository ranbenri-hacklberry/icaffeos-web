/**
 * MCP Client Service
 * Connects to the icaffeOS MCP Cloud Worker (ai.hacklberryfinn.com)
 * Implements JSON-RPC 2.0 over custom SSE (Fetch) + POST
 */

const MCP_URL = 'https://ai.hacklberryfinn.com';
const API_KEY = import.meta.env.VITE_MCP_API_KEY;

let sessionId = null;
let postEndpoint = null;
let isConnected = false;
let isInitialized = false;

// Simple event emitter for messages
const listeners = [];
export const onMcpMessage = (callback) => listeners.push(callback);

const pendingCalls = new Map();

/**
 * Connect to the MCP Server via Fetch-based SSE (to support headers)
 */
export const connectToMCP = async () => {
    if (isConnected && isInitialized) return true;
    console.log('🔌 [MCP] Connecting to', MCP_URL);

    try {
        const response = await fetch(`${MCP_URL}/sse`, {
            headers: {
                'X-MCP-API-Key': API_KEY,
                'Accept': 'text/event-stream'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`MCP Connection Failed: ${response.status} ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextEncoder();

        isConnected = true;
        console.log('✅ [MCP] Stream connected');

        // Start reading the stream (async, doesn't block)
        const streamPromise = readStream(reader, decoder);

        // Wait for postEndpoint to be set via 'endpoint' event
        let attempts = 0;
        while (!postEndpoint && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!postEndpoint) throw new Error('Timed out waiting for MCP endpoint');

        // Send Initialize
        console.log('🏁 [MCP] Initializing...');
        await sendRpc('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'icaffeos-maya', version: '1.0.0' }
        });

        // Send Initialized notification
        await sendRpc('notifications/initialized', {}, null);

        isInitialized = true;
        console.log('🚀 [MCP] Ready');

        return true;
    } catch (error) {
        console.error('❌ [MCP] Connection error:', error);
        isConnected = false;
        return { error: error.message };
    }
};

const readStream = async (reader, decoder) => {
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('🔌 [MCP] Stream closed by server');
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep partial line

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('event: endpoint')) {
                    // Next data line will contain the endpoint
                } else if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.slice(6).trim();

                    // Handle session endpoint string
                    if (dataStr.startsWith('/') || dataStr.includes('sessionId=')) {
                        postEndpoint = dataStr;
                        if (postEndpoint.startsWith('/')) postEndpoint = MCP_URL + postEndpoint;
                        console.log('🔗 [MCP] Session Endpoint:', postEndpoint);
                        continue;
                    }

                    try {
                        const json = JSON.parse(dataStr);
                        console.log('📥 [MCP] RPC:', json);

                        // Handle pending calls
                        if (json.id !== undefined && pendingCalls.has(json.id.toString())) {
                            const { resolve, timeout } = pendingCalls.get(json.id.toString());
                            clearTimeout(timeout);
                            pendingCalls.delete(json.id.toString());
                            resolve(json.result || json.error || json);
                        }

                        listeners.forEach(l => l(json));
                    } catch (e) {
                        console.warn('⚠️ [MCP] Failed to parse JSON:', dataStr);
                    }
                }
            }
        }
    } catch (e) {
        console.error('❌ [MCP] Stream read error:', e);
    } finally {
        isConnected = false;
        isInitialized = false;
        postEndpoint = null;
    }
};

/**
 * Send a JSON-RPC request/notification via POST
 */
const sendRpc = async (method, params = {}, id = Date.now().toString()) => {
    if (!postEndpoint) throw new Error('MCP Session not ready');

    const payload = {
        jsonrpc: '2.0',
        method,
        params
    };
    if (id !== null) payload.id = id;

    const body = JSON.stringify(payload);

    // If it's a request (has ID), we return a promise
    if (id !== null) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (pendingCalls.has(id)) {
                    pendingCalls.delete(id);
                    reject(new Error(`MCP Timeout: ${method}`));
                }
            }, 30000);

            pendingCalls.set(id, { resolve, reject, timeout });

            fetch(postEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MCP-API-Key': API_KEY
                },
                body
            }).catch(e => {
                clearTimeout(timeout);
                pendingCalls.delete(id);
                reject(e);
            });
        });
    } else {
        // Notification
        return fetch(postEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-MCP-API-Key': API_KEY
            },
            body
        });
    }
};

/**
 * Call a Tool via MCP
 */
export const callTool = async (toolName, args = {}) => {
    console.log(`🛠️ [MCP] Calling Tool: ${toolName}`, args);
    const result = await sendRpc('tools/call', {
        name: toolName,
        arguments: args
    });
    return result;
};

export const mcpClient = {
    connect: connectToMCP,
    callTool,
    onMessage: onMcpMessage
};
