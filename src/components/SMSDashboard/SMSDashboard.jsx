/**
 * SMS Dashboard - WhatsApp Web Style Interface
 * Main Component for icaffeOS SMS System
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getContacts,
    getMessages,
    addMessage,
    clearUnreadCount,
    formatPhoneDisplay,
    formatTimestamp,
    createOrUpdateContact,
    updateContactName,
    searchMessages
} from '../../db/smsDatabase';
import { useNavigate } from 'react-router-dom';

// Icons
const SearchIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const SendIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const SignalIcon = ({ strength }) => {
    const bars = Math.ceil((strength / 100) * 4);
    return (
        <div className="flex items-end gap-0.5 h-4">
            {[1, 2, 3, 4].map(i => (
                <div
                    key={i}
                    className={`w-1 rounded-sm transition-all ${i <= bars ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    style={{ height: `${i * 25}%` }}
                />
            ))}
        </div>
    );
};

const CheckIcon = ({ double }) => (
    <svg className="w-4 h-4 inline ml-1" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        {double && <path d="M15 16.17L10.83 12l-1.42 1.41L15 19 27 7l-1.41-1.41L15 16.17z" transform="translate(-6, 0)" />}
    </svg>
);

const PhoneIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);

const PlusIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const BackIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

// WebSocket connection
const SMS_WS_URL = 'ws://localhost:8085';
const SMS_API_URL = 'http://localhost:8085/api/sms';

export default function SMSDashboard() {
    // State
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [signalStrength, setSignalStrength] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatName, setNewChatName] = useState('');

    // Refs
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Load contacts on mount
    useEffect(() => {
        loadContacts();
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Load messages when contact changes
    useEffect(() => {
        if (selectedContact) {
            loadMessages(selectedContact.phone);
            clearUnreadCount(selectedContact.phone);
            loadContacts(); // Refresh to update unread count
        }
    }, [selectedContact]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when contact selected
    useEffect(() => {
        if (selectedContact && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedContact]);

    // WebSocket connection
    const connectWebSocket = useCallback(() => {
        try {
            wsRef.current = new WebSocket(SMS_WS_URL);

            wsRef.current.onopen = () => {
                console.log('📱 SMS WebSocket connected');
                setIsConnected(true);
                checkModemStatus();
            };

            wsRef.current.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };

            wsRef.current.onclose = () => {
                console.log('📱 SMS WebSocket disconnected');
                setIsConnected(false);
                // Reconnect after 5 seconds
                setTimeout(connectWebSocket, 5000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
            setTimeout(connectWebSocket, 5000);
        }
    }, []);

    // Handle WebSocket messages
    const handleWebSocketMessage = async (data) => {
        switch (data.type) {
            case 'connected':
                console.log('Connected to SMS gateway');
                break;

            case 'modem_status':
                setIsConnected(data.status === 'ready');
                if (data.signal) setSignalStrength(data.signal);
                break;

            case 'signal_update':
                setSignalStrength(data.signal);
                break;

            case 'new_sms':
                // Add incoming message to database
                await addMessage({
                    phone: data.message.from,
                    type: 'incoming',
                    content: data.message.content,
                    timestamp: data.message.timestamp,
                    status: 'received'
                });

                // Refresh if viewing this conversation
                if (selectedContact?.phone === data.message.from) {
                    loadMessages(data.message.from);
                }

                // Refresh contacts list
                loadContacts();
                break;

            case 'sms_sent':
                // Update local state
                if (selectedContact?.phone === data.message.to) {
                    loadMessages(data.message.to);
                }
                loadContacts();
                break;
        }
    };

    // Check modem status
    const checkModemStatus = async () => {
        try {
            const response = await fetch(`${SMS_API_URL}/status`);
            const data = await response.json();
            setIsConnected(data.ready);
            setSignalStrength(data.signal || 0);
        } catch (error) {
            console.error('Error checking modem status:', error);
        }
    };

    // Load contacts from database
    const loadContacts = async () => {
        const contactsList = await getContacts();
        setContacts(contactsList);
    };

    // Load messages for a contact
    const loadMessages = async (phone) => {
        const messagesList = await getMessages(phone);
        setMessages(messagesList);
    };

    // Send message
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedContact) return;

        setIsLoading(true);
        const messageContent = newMessage.trim();
        setNewMessage('');

        try {
            // Add to local database first (optimistic update)
            await addMessage({
                phone: selectedContact.phone,
                type: 'outgoing',
                content: messageContent,
                timestamp: new Date().toISOString(),
                status: 'sending'
            });

            // Refresh messages
            loadMessages(selectedContact.phone);

            // Send via API
            const response = await fetch(`${SMS_API_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: selectedContact.phone,
                    message: messageContent
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send SMS');
            }

            // Refresh after send
            loadMessages(selectedContact.phone);
            loadContacts();

        } catch (error) {
            console.error('Error sending message:', error);
            // Could update message status to 'failed' here
        }

        setIsLoading(false);
    };

    // Handle key press in input
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Start new chat
    const handleStartNewChat = async () => {
        if (!newChatPhone.trim()) return;

        const contactId = await createOrUpdateContact(newChatPhone, newChatName || null);
        const contact = {
            id: contactId,
            phone: newChatPhone,
            name: newChatName || formatPhoneDisplay(newChatPhone)
        };

        setSelectedContact(contact);
        setShowNewChat(false);
        setNewChatPhone('');
        setNewChatName('');
        loadContacts();
    };

    // Filter contacts by search
    const filteredContacts = contacts.filter(contact =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.includes(searchQuery)
    );

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden" dir="rtl">
            {/* Sidebar - Contact List */}
            <motion.div
                className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col"
                initial={{ x: 100 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/super-admin')}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <BackIcon />
                            </button>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <PhoneIcon />
                                הודעות SMS
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <SignalIcon strength={signalStrength} />
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-700 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {/* New Chat Button */}
                <button
                    onClick={() => setShowNewChat(true)}
                    className="m-3 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <PlusIcon />
                    שיחה חדשה
                </button>

                {/* Contact List */}
                <div className="flex-1 overflow-y-auto">
                    <AnimatePresence>
                        {filteredContacts.map((contact, index) => (
                            <ContactItem
                                key={contact.id}
                                contact={contact}
                                isSelected={selectedContact?.id === contact.id}
                                onClick={() => setSelectedContact(contact)}
                                index={index}
                            />
                        ))}
                    </AnimatePresence>

                    {filteredContacts.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                            אין שיחות
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-900">
                {selectedContact ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
                            <button
                                onClick={() => setSelectedContact(null)}
                                className="lg:hidden p-2 hover:bg-gray-700 rounded-lg"
                            >
                                <BackIcon />
                            </button>

                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold">
                                {selectedContact.name?.charAt(0) || '?'}
                            </div>

                            <div className="flex-1">
                                <h2 className="font-bold">{selectedContact.name}</h2>
                                <p className="text-sm text-gray-400">{formatPhoneDisplay(selectedContact.phone)}</p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-2"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234a5568' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                            }}
                        >
                            <AnimatePresence>
                                {messages.map((message, index) => (
                                    <MessageBubble
                                        key={message.id || index}
                                        message={message}
                                        index={index}
                                    />
                                ))}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-gray-800 border-t border-gray-700">
                            <div className="flex items-end gap-3">
                                <textarea
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="הקלד הודעה..."
                                    rows={1}
                                    className="flex-1 bg-gray-700 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    style={{ maxHeight: '120px' }}
                                />

                                <motion.button
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim() || isLoading}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`p-3 rounded-full transition-colors ${newMessage.trim()
                                        ? 'bg-purple-600 hover:bg-purple-700'
                                        : 'bg-gray-700 cursor-not-allowed'
                                        }`}
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <SendIcon />
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <PhoneIcon className="w-12 h-12" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">ברוכים הבאים ל-SMS</h2>
                        <p>בחר שיחה או התחל שיחה חדשה</p>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            <AnimatePresence>
                {showNewChat && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNewChat(false)}
                    >
                        <motion.div
                            className="bg-gray-800 rounded-xl p-6 w-96 max-w-[90vw]"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold mb-4">שיחה חדשה</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">מספר טלפון</label>
                                    <input
                                        type="tel"
                                        value={newChatPhone}
                                        onChange={(e) => setNewChatPhone(e.target.value)}
                                        placeholder="050-000-0000"
                                        className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        dir="ltr"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">שם (אופציונלי)</label>
                                    <input
                                        type="text"
                                        value={newChatName}
                                        onChange={(e) => setNewChatName(e.target.value)}
                                        placeholder="שם איש הקשר"
                                        className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowNewChat(false)}
                                        className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={handleStartNewChat}
                                        disabled={!newChatPhone.trim()}
                                        className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    >
                                        התחל שיחה
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Contact List Item Component
function ContactItem({ contact, isSelected, onClick, index }) {
    const [lastMessage, setLastMessage] = useState(null);

    useEffect(() => {
        const fetchLastMessage = async () => {
            const messages = await getMessages(contact.phone, 1);
            if (messages.length > 0) {
                setLastMessage(messages[messages.length - 1]);
            }
        };
        fetchLastMessage();
    }, [contact.phone]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ delay: index * 0.05 }}
            onClick={onClick}
            className={`p-4 border-b border-gray-700 cursor-pointer transition-colors hover:bg-gray-700 ${isSelected ? 'bg-gray-700' : ''
                }`}
        >
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {contact.name?.charAt(0) || '?'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold truncate">{contact.name}</h3>
                        {lastMessage && (
                            <span className="text-xs text-gray-500">
                                {formatTimestamp(lastMessage.timestamp)}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate">
                            {lastMessage?.content || 'אין הודעות'}
                        </p>

                        {contact.unreadCount > 0 && (
                            <span className="bg-purple-600 text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                {contact.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Message Bubble Component
function MessageBubble({ message, index }) {
    const isOutgoing = message.type === 'outgoing';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
                type: 'spring',
                stiffness: 500,
                damping: 40,
                delay: index * 0.02
            }}
            className={`flex ${isOutgoing ? 'justify-start' : 'justify-end'}`}
        >
            <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${isOutgoing
                    ? 'bg-purple-600 rounded-br-sm'
                    : 'bg-gray-700 rounded-bl-sm'
                    }`}
            >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>

                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isOutgoing ? 'text-purple-200' : 'text-gray-400'
                    }`}>
                    <span>{formatTimestamp(message.timestamp)}</span>

                    {isOutgoing && (
                        <span className={message.status === 'sent' ? 'text-blue-400' : ''}>
                            <CheckIcon double={message.status === 'delivered' || message.status === 'read'} />
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
