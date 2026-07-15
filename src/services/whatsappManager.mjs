
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, '..', '..', '.wwebjs_auth');
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const instances = {};

/**
 * Initialize WhatsApp connection for a specific business instance
 */
async function connectToWhatsApp(instanceName, io) {
    console.log(`📱 [WhatsApp] Initializing instance: ${instanceName}`);

    const { state, saveCreds } = await useMultiFileAuthState(path.join(SESSIONS_DIR, instanceName));

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Show in terminal as well for backup
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '121.0.0.0']
    });

    instances[instanceName] = { sock, qr: null, status: 'connecting' };

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`📱 [WhatsApp] QR Generated for ${instanceName}`);
            instances[instanceName].qr = qr;
            instances[instanceName].status = 'qr_ready';
            // Emit QR to frontend if socket available
            if (io) io.emit(`whatsapp-qr-${instanceName}`, qr);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`📱 [WhatsApp] Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
            instances[instanceName].status = 'disconnected';

            if (shouldReconnect) {
                // Reconnect logic
                connectToWhatsApp(instanceName, io);
            } else {
                console.log(`📱 [WhatsApp] Session logged out. Please re-scan.`);
                // Clean up session files?
            }
        } else if (connection === 'open') {
            console.log(`📱 [WhatsApp] Connected successfully: ${instanceName}`);
            instances[instanceName].status = 'connected';
            instances[instanceName].qr = null;
            if (io) io.emit(`whatsapp-status-${instanceName}`, 'connected');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
}

/**
 * Get status of an instance
 */
function getStatus(instanceName) {
    if (!instances[instanceName]) return { status: 'disconnected' };
    return {
        status: instances[instanceName].status,
        qr: instances[instanceName].qr
    };
}

/**
 * Send a text message
 */
async function sendText(instanceName, to, text) {
    const session = instances[instanceName];
    if (!session || session.status !== 'connected') {
        throw new Error('WhatsApp instance not connected');
    }

    try {
        const id = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
        await session.sock.sendMessage(id, { text });
        console.log(`📱 [WhatsApp] Sent to ${to}: "${text}"`);
        return true;
    } catch (err) {
        console.error(`📱 [WhatsApp] Send failed:`, err);
        throw err;
    }
}

/**
 * Disconnect/Logout
 */
async function disconnect(instanceName) {
    const session = instances[instanceName];
    if (session?.sock) {
        try {
            await session.sock.logout();
            delete instances[instanceName];
            // Clear auth folder
            const authPath = path.join(SESSIONS_DIR, instanceName);
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            return true;
        } catch (err) {
            console.error(`📱 [WhatsApp] Logout failed:`, err);
            throw err;
        }
    }
    return false;
}

export default {
    connectToWhatsApp,
    getStatus,
    sendText,
    disconnect
};
