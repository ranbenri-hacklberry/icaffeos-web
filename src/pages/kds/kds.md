# iCaffeOS KDS Technical Documentation
**Last Updated:** April 2026
**Location:** `/src/pages/kds/`

## 1. Overview and Architecture
The Kitchen Display System (KDS) for iCaffeOS runs entirely as a **Local-First / Offline-First** system, built for zero latency and high resilience during rush hours.

Instead of strictly waiting for round trips to Supabase for every click, the KDS architecture relies on **Dexie (IndexedDB)** as the local persistence layer, wrapped in a **React Optimistic UI**. This achieves immediate (sub-millisecond) feedback for baristas on Apple iPad tablets.

## 2. Core Components

### `index.jsx` (KDS Root)
- The main layout wrapper and state provider for the Kanban/Active KDS view.
- Subscribes to real-time syncs if network is available.
- Renders `OrderCard.jsx` lists based on order status (`current` vs `completed`).

### `hooks/useKDSDataLocal.js` (The Engine)
This is the only hook managing KDS data, replacing the bloated `useKDSData.js`. 
- **`useLiveQuery(activeOrders)`**: Pulls today's orders (starting purely at 05:00 AM) locally from Dexie.
- **`optimisticState` (React State)**: Crucial anti-freeze mechanism. Masks Dexie delays (which can block the async thread) by mutating the UI state immediately.
- **Background Syncing**: After the optimistic UI pushes a ticket, it triggers `db.transaction()` and Supabase `.rpc()` updates without any `await` locking the UI.

### `hooks/useKDSSms.js`
Handles notifying patrons via GlobalSMS when orders are complete.
- Implements `fireAndForgetSms()` for non-blocking API calls.
- Provides `getSmsStatus(orderId)` which maps `pending`, `sent`, or `failed` directly to the `OrderCard` top-right tag, based on API responses.

### `components/OrderCard.jsx`
Responsible for visual rendering of an order or specific item block.
- Implements item splitting (left/right columns for >5 items).
- Automatically calculates aging colors (pulses red if >30 minutes).
- **Rule Engine**: Filters and dims specific items based on their individual terminal status.

## 3. Data Flow & Sync Mechanisms
When a Barista taps "Ready":
1. `setOptimisticState` fires instantly, mimicking the change without hitting DB.
2. `useMemo` in `processedOrders` catches the mask and re-render instantly.
3. `db.orders.update` executes synchronously inside Dexie (IndexedDB).
4. `supabase.rpc('update_order_status_v3')` fires lazily over the network.
5. If network is completely offline, Dexie queues it, and `syncQueue()` attempts a loop every 10 seconds to resync the local state with Supabase.

### "Shadow Dexie" Architecture (The Passive Mirror)
The **Server-Authoritative Pattern**:
- **The UI/Action Flow**: When a user interacts with a card (e.g., 'Ready'), the KDS NEVER writes directly to Dexie. It updates a local Optimistic React State (the mask) for instant feedback and fires an RPC to Supabase.
- **The Source of Truth**: Only the Supabase Realtime subscription is authorized to update the local Dexie store. 
- **The Loop**: Action → Server RPC → Server Broadcast → Tablet Listener → Dexie Update → UI Hydration.
- **Result**: Dexie remains a pure, passive shadow of the server state. If the server rejects the change, the local Dexie (and eventually the UI) will never reflect it.

> [!WARNING]
> Phantom Order Protection: `CREATE_ORDER` is structurally blocked inside `offlineQueue.js`. Supabase level SQL triggers (`block_empty_orders`) prevent ghost inserts with `total_amount = 0`. KDS interacts exclusively through `UPDATE_ORDER_STATUS`.

## 4. Prep Routing Logic (CRITICAL)
Not all menu items belong in the KDS. Items are intelligently routed.

**Rule Engine Path**: `isPrepRequired` (computed in `useKDSDataLocal.js`)
If `isPrepRequired === false`, the KDS hook filters it out completely before `OrderCard` sees it. It literally doesn't exist on the KDS tablet.

1. **Made To Order**: (e.g. Cappuccino, Toast). Displays natively on KDS.
2. **Grab & Go**: (e.g. Bottled Water, Cookie bag). Filtered out. Barista never interact with it.
3. **POS Override**: If a cashier taps "Received Ready" during POS checkout, `effectiveLogic` evaluates to `DELIVERED`, setting `isPrepRequired` to False. Disappears from KDS.

If an entire order consists of *only* Grab & Go items, `processedItems.length === 0` and the order bypasses the tablet entirely.

## 5. Security and Legacy Rules
- **DO NOT reinstante** `useKDSData.js` or standard network-only fetching. The iPad processing power chokes on standard array rendering above 50 items.
- Ensure any new items added to Supabase `menu_items` have accurate `kds_routing_logic` mapped natively.
