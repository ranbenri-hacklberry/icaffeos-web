/**
 * Dexie.js Database Schema
 * Offline-first local database that mirrors Supabase tables
 * 
 * @module db/database
 */

import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('KDSDatabase');

// Define schema version 1
// Note: Only indexed fields are listed. Other fields (like JSONB mods, settings)
// are stored in the object but not indexed for performance.
db.version(1).stores({
    // Active order items - for real-time KDS display
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',

    // Businesses - multi-tenant support
    businesses: 'id, name',

    // Catalog items (menu items) - for displaying menu
    catalog_items: 'id, name, category, created_at',

    // Customers - for loyalty and order history
    customers: 'id, phone_number, name, business_id',

    // Device sessions - for iPad authentication
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',

    // Discounts - soldier discount, etc.
    discounts: 'id, name, business_id, is_active, discount_code',

    // Employees - for PIN/NFC login
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',

    // Ingredients - for inventory tracking
    ingredients: 'id, name, supplier_id',

    // Orders - full order records
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',

    // Order items - individual items in orders
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',

    // Menu items - full menu catalog
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',

    // Sync metadata - track last sync times
    sync_meta: 'table_name, last_synced_at, record_count'
});

// Version 2: Add offline queue for pending actions
db.version(2).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt'
});

// Version 3: Add option groups and values for modifiers (e.g., milk type, size)
db.version(3).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id'
});

// Version 4: Add loyalty_purchases for coffee/points tracking
db.version(4).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    // Added phone index for quick lookup
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    // NEW: Loyalty purchases (coffee tracking)
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption'
});

// Version 5: Add cached_images for offline menu item pictures
db.version(5).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    // NEW: Cached images for offline menu display
    cached_images: 'url, cached_at'
});

// Version 6: Enhanced sync capabilities
// Added better indexing for queue and new sync_status table
db.version(6).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    cached_images: 'url, cached_at',

    // ENHANCED: detailed queue for generic CRUD actions
    // Renamed to v2 to fix UpgradeError (PK change from id to ++id)
    offline_queue: null, // Drop old table
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',

    // NEW: Per-record sync status for granular conflict resolution
    // _localUpdatedAt and _pendingSync are stored in object but not indexed usually, 
    // unless we need to query by them. unique_id is table+recordId
    sync_status: 'id, table, recordId, status, updated_at'
});

// Version 7: Add _processing index to orders to fix query errors
db.version(7).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    // ADDED _processing here
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at, _processing',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at'
});

// Version 11: Add business_id to loyalty_transactions index
db.version(11).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at, _processing, [business_id+created_at]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at',
    // INDEXED business_id for filtering
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at'
});

// Version 12: Kanban Order System - Add order_type, order_origin, seen_at indexes
db.version(12).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    ingredients: 'id, name, supplier_id',
    // ENHANCED: Added order_type, order_origin, seen_at for Kanban filtering
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    // NEW: Delivery settings cache
    delivery_settings: 'id, business_id'
});

// Version 13: Emergency Queue Reset - Fixes status reversion bug
// Drops v2 queue (clearing stuck actions) and creates v3
db.version(13).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null, // CLEAR POISONED QUEUE
    delivery_settings: 'id, business_id'
});

// Version 15: Add server_updated_at and more indexes for conflict resolution & performance
db.version(15).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    // Added updated_at index
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    ingredients: 'id, name, supplier_id',
    // ADDED server_updated_at for conflict resolution
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    // Added last_updated for sync
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at'
});

// Version 19: Add prep-specific tables for offline management
db.version(19).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    // NEW & REFINED for Prep/Inventory
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, item_name, current_stock, updated_at'
});

// Version 20: Add inventory_items (Promise)
db.version(20).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, item_name, current_stock, updated_at'
});

// Version 21: Add item_category
// ⚠️ CRITICAL: Must re-declare ALL tables from previous version!
db.version(21).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, name, current_stock, updated_at',
    // NEW in v21
    item_category: 'id, name, name_he, business_id, position'
});

// Version 24: Persistent Playback Queue - Add playback_queue
db.version(24).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, name, current_stock, updated_at',
    item_category: 'id, name, name_he, business_id, position',
    system_config: 'id, key, updated_at',
    local_assets: 'id, file_path, artist, title, album, genre, year, duration, scanned_at',
    music_cache_stats: 'song_id, last_played_at, play_count, is_cached, file_size',
    // NEW in v24: Persistent Playback Queue
    playback_queue: '++id, track_id, position, is_current, added_at'
});

// Version 25: Add pending_sync index to orders (required by useOrderPush .where('pending_sync'))
db.version(25).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, pending_sync, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, item_name, current_stock, updated_at',
    item_category: 'id, name, name_he, business_id, position',
    system_config: 'id, key, updated_at',
    local_assets: 'id, file_path, artist, title, album, genre, year, duration, scanned_at',
    music_cache_stats: 'song_id, last_played_at, play_count, is_cached, file_size',
    playback_queue: '++id, track_id, position, is_current, added_at'
});

// Version 26: Add modifiers to menu_items for universal parsing
db.version(26).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, pending_sync, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    // ADDED modifiers here for indexing if needed (storing JSONB)
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic, modifiers',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, item_name, current_stock, updated_at',
    item_category: 'id, name, name_he, business_id, position',
    system_config: 'id, key, updated_at',
    local_assets: 'id, file_path, artist, title, album, genre, year, duration, scanned_at',
    music_cache_stats: 'song_id, last_played_at, play_count, is_cached, file_size',
    playback_queue: '++id, track_id, position, is_current, added_at'
});

// Version 27: Music → Rantunes table rename
// Drops music_cache_stats in favour of rantunes_cache_stats
db.version(27).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id, updated_at',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id, is_driver',
    orders: 'id, order_number, order_status, order_type, order_origin, is_paid, customer_id, business_id, created_at, updated_at, server_updated_at, seen_at, _processing, pending_sync, [business_id+created_at], [business_id+order_status]',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic, modifiers',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_cards: 'id, customer_id, customer_phone, business_id, points_balance, created_at, last_updated',
    loyalty_transactions: 'id, card_id, order_id, business_id, transaction_type, created_at',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: null,
    offline_queue_v3: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at',
    delivery_settings: 'id, business_id',
    menu_cache: 'business_id, updated_at',
    onboarding_sessions: '++id, business_id, step, updated_at',
    system_health_checks: 'id, business_id, status, created_at',
    recurring_tasks: 'id, business_id, category, menu_item_id, is_active',
    task_completions: 'id, recurring_task_id, completion_date, business_id',
    prepared_items_inventory: 'item_id, business_id',
    suppliers: 'id, name, business_id',
    inventory_items: 'id, business_id, item_name, current_stock, updated_at',
    item_category: 'id, name, name_he, business_id, position',
    system_config: 'id, key, updated_at',
    local_assets: 'id, file_path, artist, title, album, genre, year, duration, scanned_at',
    music_cache_stats: null,               // ❌ DROPPED - renamed to rantunes_cache_stats
    rantunes_cache_stats: 'song_id, last_played_at, play_count, is_cached, file_size',
    playback_queue: '++id, track_id, position, is_current, added_at'
});
export const {
    active_order_items,
    businesses,
    catalog_items,
    customers,
    device_sessions,
    discounts,
    employees,
    orders,
    order_items,
    menu_items,
    sync_meta,
    cached_images,
    loyalty_cards,
    loyalty_transactions,
    menu_cache,
    onboarding_sessions,
    system_health_checks,
    recurring_tasks,
    task_completions,
    prepared_items_inventory,
    suppliers,
    inventory_items,
    item_category,
    system_config,
    local_assets,
    rantunes_cache_stats, // ✅ Renamed from music_cache_stats
    playback_queue
} = db;


// Database health check
export const isDatabaseReady = async () => {
    try {
        await db.open();
        return true;
    } catch (error) {
        console.error('❌ Dexie database failed to open:', error);
        return false;
    }
};

// Clear all data (for debugging/logout)
export const clearAllData = async () => {
    await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
            await table.clear();
        }
    });
    console.log('🗑️ All local data cleared');
};

// Get sync status for all tables
export const getSyncStatus = async () => {
    const status = await sync_meta.toArray();
    return status.reduce((acc, item) => {
        acc[item.table_name] = {
            lastSynced: item.last_synced_at,
            recordCount: item.record_count
        };
        return acc;
    }, {});
};

export default db;
