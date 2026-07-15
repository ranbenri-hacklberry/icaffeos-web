import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';
import { db } from '../db/database.js';

export const useStore = create((set, get) => ({
    // --- User State ---
    currentUser: null,
    login: async (pin) => {
        try {
            // 1. Special Admin / Support PIN '000000' => iCaffe Context
            if (pin === '000000') {
                console.log('🚀 Logging in as iCaffe Admin...');
                let icaffeBiz = null;

                if (navigator.onLine) {
                    // Try to find the real 'icaffe' business
                    const { data } = await supabase.from('businesses')
                        .select('id, name')
                        .ilike('name', 'icaffe')
                        .maybeSingle();
                    icaffeBiz = data;
                }

                // Create a master session
                const masterUser = {
                    id: 'icaffe-master-user',
                    name: 'iCaffe Support',
                    pin_code: '000000',
                    role: 'owner',
                    business_id: icaffeBiz?.id || 'icaffe-demo-id',
                    business_name: icaffeBiz?.name || 'iCaffe HQ',
                    access_level: 'Owner'
                };

                set({ currentUser: masterUser });
                return true;
            }

            // 2. Standard Employee Login
            let user = await db.employees.where('pin_code').equals(pin).first();

            if (navigator.onLine) {
                const { data, error } = await supabase.from('employees').select('*').eq('pin_code', pin).maybeSingle();
                if (data && !error) {
                    if (data.business_id) {
                        try {
                            const { data: bData } = await supabase.from('businesses').select('name').eq('id', data.business_id).single();
                            if (bData?.name) data.business_name = bData.name;
                        } catch (e) { /* ignore */ }
                    }

                    // Update local cache
                    const existing = await db.employees.where('pin_code').equals(pin).first();
                    if (!existing) {
                        await db.employees.add(data);
                    } else {
                        if (existing.business_id !== data.business_id || existing.business_name !== data.business_name) {
                            await db.employees.update(existing.id, data);
                        }
                    }
                    user = data;
                }
            }

            // 3. Fallback to Demo
            if (!user && pin === '1234') {
                user = {
                    id: crypto.randomUUID(),
                    name: 'Demo Admin',
                    pin_code: '1234',
                    role: 'admin',
                    business_id: 'lite-demo-business',
                    access_level: 'Owner'
                };
            }

            if (user) {
                if (user.business_id && navigator.onLine) {
                    try {
                        const { data } = await supabase.from('businesses').select('name').eq('id', user.business_id).single();
                        if (data) user.business_name = data.name;
                    } catch (err) { console.error("Failed to fetch business name", err); }
                }

                set({ currentUser: user });
                return true;
            }
            return false;
        } catch (e) {
            console.error("Login failed", e);
            return false;
        }
    },
    logout: () => set({ currentUser: null }),

    // --- Menu State ---
    menuItems: [],
    fetchMenu: async () => {
        const { currentUser } = get();
        try {
            if (!navigator.onLine) {
                console.warn("Offline: Cannot fetch menu.");
                return;
            }

            let items = [];
            if (currentUser?.business_id && currentUser?.id !== 'icaffe-master-user') {
                const { data, error } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('business_id', currentUser.business_id)
                    .eq('is_active', true);

                if (!error && data) {
                    items = data;
                } else if (error) {
                    console.error("Supabase menu fetch error", error);
                }
            } else {
                const { data, error } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('is_active', true);
                if (!error && data) {
                    items = data;
                }
            }

            set({ menuItems: items });
        } catch (e) {
            console.error("Fetch Menu Error", e);
            set({ menuItems: [] }); // Clear items on error
        }
    },

    // --- Cart State ---
    cart: [],
    addToCart: (item) => set((state) => ({ cart: [...state.cart, { ...item, internalId: crypto.randomUUID() }] })),
    removeFromCart: (internalId) => set((state) => ({ cart: state.cart.filter(i => i.internalId !== internalId) })),
    clearCart: () => set({ cart: [] }),

    // --- KDS State ---
    activeOrders: [],
    focusedKDSIndex: 0,
    setFocusedKDSIndex: (index) => set({ focusedKDSIndex: index }),

    fetchBusinessDetails: async (businessId) => {
        if (!businessId) return;
        try {
            const { data } = await supabase.from('businesses').select('name').eq('id', businessId).single();
            if (data) {
                set(state => ({ currentUser: { ...state.currentUser, business_name: data.name } }));
            }
        } catch (e) { console.error('Error fetching business details', e); }
    },

    fetchKDSOrders: async () => {
        const { currentUser } = get();
        try {
            if (!navigator.onLine) {
                console.warn("Offline: Cannot fetch active KDS orders.");
                return;
            }

            const today = new Date();
            today.setHours(5, 0, 0, 0);
            if (new Date() < today) today.setDate(today.getDate() - 1);

            const { data, error } = await supabase.rpc('get_kds_orders', {
                p_date: today.toISOString(),
                p_business_id: currentUser.business_id
            });

            if (error) {
                console.error("KDS Fetch Server Error", error);
                return;
            }

            if (data) {
                let currentMenuItems = get().menuItems;
                if (currentMenuItems.length === 0) {
                    await get().fetchMenu();
                    currentMenuItems = get().menuItems;
                }

                const fullOrders = data.map(order => {
                    const items = (order.items_detail || []).map(item => {
                        let finalItem = { ...item, order_id: order.id };
                        if (item.menu_items && item.menu_items.name) {
                            finalItem.name = item.menu_items.name;
                        }
                        if (!finalItem.name && finalItem.menu_item_id) {
                            const menuItem = currentMenuItems.find(m => m.id === finalItem.menu_item_id);
                            if (menuItem) finalItem.name = menuItem.name;
                        }
                        return finalItem;
                    });

                    return {
                        ...order,
                        items
                    };
                }).filter(order => {
                    const s = order.order_status || order.status;
                    return s !== 'completed' && s !== 'cancelled';
                }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                set({ activeOrders: fullOrders });
            }
        } catch (e) {
            console.error("KDS Fetch Error", e);
        }
    },

    markOrderCompleted: async (orderId) => {
        if (!navigator.onLine) return;
        const updateData = { order_status: 'completed', updated_at: new Date().toISOString() };
        try {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (!error) {
                await supabase.from('order_items').update({ item_status: 'completed' }).eq('order_id', orderId);
                get().fetchKDSOrders();
            }
        } catch (e) {
            console.error("KDS Mark Completed Error", e);
        }
    },

    undoReady: async (orderId) => {
        if (!navigator.onLine) return;
        const updateData = { order_status: 'in_progress', updated_at: new Date().toISOString() };
        try {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (!error) get().fetchKDSOrders();
        } catch (e) {
            console.error("KDS Undo Ready Error", e);
        }
    },

    markOrderReady: async (orderId) => {
        if (!navigator.onLine) return;
        const updateData = { order_status: 'ready', updated_at: new Date().toISOString() };
        try {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (!error) get().fetchKDSOrders();
        } catch (e) {
            console.error("KDS Mark Ready Error", e);
        }
    },

    updateItemServedStatus: async (itemId, isServed) => {
        if (!navigator.onLine) return;
        const status = isServed ? 'completed' : 'in_progress';
        const updateData = {
            item_status: status,
            served_at: isServed ? new Date().toISOString() : null
        };
        try {
            const { error } = await supabase.from('order_items').update(updateData).eq('id', itemId);
            if (!error) get().fetchKDSOrders();
        } catch (e) {
            console.error("KDS Update Item Served Error", e);
        }
    },

    submitOrder: async (options = {}) => {
        const { currentUser, cart } = get();
        if (!currentUser) return { success: false, error: "No user" };

        const paymentMethod = options.paymentMethod || 'cash';
        const customerName = options.customerName || null;
        const customerPhone = (options.phoneNumber || '').replace(/\D/g, '');

        if (!navigator.onLine) {
            return { success: false, error: "אין חיבור לרשת. לא ניתן לשלוח הזמנות במצב לא מקוון." };
        }

        const newOrderId = crypto.randomUUID();

        try {
            const { data, error } = await supabase.rpc('submit_order_v3', {
                p_customer_phone: customerPhone,
                p_customer_name: customerName,
                p_items: cart.map(i => ({
                    menu_item_id: i.id,
                    quantity: i.quantity || 1,
                    mods: i.selectedOptions || i.mods || []
                })),
                p_payment_method: paymentMethod,
                p_is_paid: true,
                p_order_id: newOrderId,
                p_business_id: currentUser.business_id
            });

            if (error) {
                return { success: false, error: error.message };
            }

            const orderNumber = data?.order_number || '';
            set({ cart: [] });
            get().fetchKDSOrders();

            let smsResult = null;
            if (customerPhone && orderNumber) {
                try {
                    const { error: smsError } = await supabase.functions.invoke('send-sms', {
                        body: {
                            phone: customerPhone,
                            message: `היי ${customerName || ''}, הזמנתך #${orderNumber} התקבלה בהצלחה!`.trim(),
                            businessId: currentUser.business_id
                        }
                    });
                    smsResult = smsError ? `❌ שגיאת SMS` : `✅ SMS נשלח`;
                } catch (e) { 
                    smsResult = `❌ כשל ב-SMS`; 
                }
            }

            return { success: true, orderId: newOrderId, orderNumber, smsResult };
        } catch (e) {
            console.error("Submit Order Failed", e);
            return { success: false, error: e.message };
        }
    },
}));
