/**
 * SMS Database - Dexie.js Offline Storage
 * WhatsApp-style local message storage
 */

import Dexie from 'dexie';

// Create database instance
const smsDB = new Dexie('icaffeOS_SMS');

// Define schema
smsDB.version(1).stores({
    contacts: '++id, phone, name, lastMessageAt, unreadCount',
    messages: '++id, contactId, phone, type, content, timestamp, status, [phone+timestamp]',
    settings: 'key, value'
});

// ============================================
// Contact Operations
// ============================================

export async function getContacts() {
    return await smsDB.contacts
        .orderBy('lastMessageAt')
        .reverse()
        .toArray();
}

export async function getContact(phone) {
    const normalizedPhone = normalizePhone(phone);
    return await smsDB.contacts
        .where('phone')
        .equals(normalizedPhone)
        .first();
}

export async function createOrUpdateContact(phone, name = null) {
    const normalizedPhone = normalizePhone(phone);
    const existing = await getContact(normalizedPhone);

    if (existing) {
        await smsDB.contacts.update(existing.id, {
            name: name || existing.name,
            lastMessageAt: new Date().toISOString()
        });
        return existing.id;
    }

    return await smsDB.contacts.add({
        phone: normalizedPhone,
        name: name || formatPhoneDisplay(normalizedPhone),
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0
    });
}

export async function updateContactName(phone, name) {
    const normalizedPhone = normalizePhone(phone);
    const contact = await getContact(normalizedPhone);

    if (contact) {
        await smsDB.contacts.update(contact.id, { name });
    }
}

export async function incrementUnreadCount(phone) {
    const contact = await getContact(phone);
    if (contact) {
        await smsDB.contacts.update(contact.id, {
            unreadCount: (contact.unreadCount || 0) + 1
        });
    }
}

export async function clearUnreadCount(phone) {
    const contact = await getContact(phone);
    if (contact) {
        await smsDB.contacts.update(contact.id, { unreadCount: 0 });
    }
}

// ============================================
// Message Operations
// ============================================

export async function getMessages(phone, limit = 100) {
    const normalizedPhone = normalizePhone(phone);
    return await smsDB.messages
        .where('phone')
        .equals(normalizedPhone)
        .reverse()
        .limit(limit)
        .toArray()
        .then(msgs => msgs.reverse());
}

export async function addMessage(message) {
    const normalizedPhone = normalizePhone(message.phone || message.to || message.from);

    const messageRecord = {
        phone: normalizedPhone,
        type: message.type, // 'incoming' or 'outgoing'
        content: message.content,
        timestamp: message.timestamp || new Date().toISOString(),
        status: message.status || 'sent'
    };

    // Add message
    const messageId = await smsDB.messages.add(messageRecord);

    // Update or create contact
    await createOrUpdateContact(normalizedPhone);

    // Increment unread for incoming
    if (message.type === 'incoming') {
        await incrementUnreadCount(normalizedPhone);
    }

    return messageId;
}

export async function updateMessageStatus(messageId, status) {
    await smsDB.messages.update(messageId, { status });
}

export async function getLastMessage(phone) {
    const normalizedPhone = normalizePhone(phone);
    return await smsDB.messages
        .where('phone')
        .equals(normalizedPhone)
        .reverse()
        .first();
}

export async function searchMessages(query) {
    const lowerQuery = query.toLowerCase();
    return await smsDB.messages
        .filter(msg => msg.content.toLowerCase().includes(lowerQuery))
        .toArray();
}

export async function deleteMessage(messageId) {
    await smsDB.messages.delete(messageId);
}

export async function deleteConversation(phone) {
    const normalizedPhone = normalizePhone(phone);

    // Delete all messages for this contact
    await smsDB.messages
        .where('phone')
        .equals(normalizedPhone)
        .delete();

    // Delete contact
    await smsDB.contacts
        .where('phone')
        .equals(normalizedPhone)
        .delete();
}

// ============================================
// Utility Functions
// ============================================

function normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Convert Israeli format
    if (cleaned.startsWith('0')) {
        cleaned = '+972' + cleaned.substring(1);
    } else if (cleaned.startsWith('972') && !cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+972' + cleaned;
    }

    return cleaned;
}

export function formatPhoneDisplay(phone) {
    if (!phone) return '';

    const normalized = normalizePhone(phone);

    // Format for Israeli numbers
    if (normalized.startsWith('+972')) {
        const local = normalized.substring(4);
        if (local.length === 9) {
            return `0${local.substring(0, 2)}-${local.substring(2, 5)}-${local.substring(5)}`;
        }
    }

    return normalized;
}

export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'אתמול';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('he-IL', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    }
}

// ============================================
// Export Database
// ============================================

export default smsDB;
