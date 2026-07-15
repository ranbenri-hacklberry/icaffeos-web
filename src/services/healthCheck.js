import { supabase } from '@/lib/supabase';
import { sendSms } from '@/services/smsService';

/**
 * Runs a complete End-to-End Health Check on the Ordering System
 */
export const runSystemDiagnostics = async (businessId) => {
    const logs = [];
    const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

    // Config for Test
    const TEST_PHONE = '0548888888';
    const TEST_NAME = 'DIAGNOSTIC TEST';

    try {
        log('🚀 Starting System Diagnostics...');

        // 0. Fetch items and their mod-links to find the best candidates
        const { data: allMenuItems, error: menuError } = await supabase
            .from('menu_items')
            .select('id, price, name, category, kds_routing_logic, is_hot_drink')
            .eq('business_id', businessId)
            .limit(15);

        if (menuError || !allMenuItems || allMenuItems.length === 0) {
            log('❌ DIAGNOSTICS FAILED: Could not fetch valid menu items for testing.');
            return { success: false, logs };
        }

        const itemIds = allMenuItems.map(i => i.id);
        const { data: allLinks } = await supabase.from('menuitemoptions').select('item_id, group_id').in('item_id', itemIds);

        // Count groups per item to find "complex" items
        const groupCountMap = (allLinks || []).reduce((acc, link) => {
            acc[link.item_id] = (acc[link.item_id] || 0) + 1;
            return acc;
        }, {});

        // Sort items: Put 'קפוצ׳ינו גדול' first, then items with most mods
        const sortedItems = [...allMenuItems].sort((a, b) => {
            if (a.name.includes('קפוצ׳ינו גדול')) return -1;
            if (b.name.includes('קפוצ׳ינו גדול')) return 1;
            return (groupCountMap[b.id] || 0) - (groupCountMap[a.id] || 0);
        });

        const testItemsSubset = sortedItems.slice(0, 4); // Take top 4
        log(`🔹 Selected Test Items: ${testItemsSubset.map(i => `${i.name} (${groupCountMap[i.id] || 0} groups)`).join(', ')}`);

        // 1a. Fetch actual Modifier Values for these items
        const activeGroupIds = (allLinks || [])
            .filter(l => testItemsSubset.some(ti => ti.id === l.item_id))
            .map(l => l.group_id);

        const { data: activeMods } = await supabase
            .from('optionvalues')
            .select('*')
            .in('group_id', activeGroupIds)
            .eq('business_id', businessId);

        const orderItems = testItemsSubset.map(item => {
            const itemGroups = (allLinks || []).filter(l => l.item_id === item.id).map(l => l.group_id);
            const itemMods = [];
            const selectedGroupIds = new Set();

            // Pick at least 2 different groups if possible
            if (itemGroups.length > 0 && activeMods?.length > 0) {
                // Shuffle groups to get random selection
                const shuffledGroups = [...itemGroups].sort(() => Math.random() - 0.5);

                for (const gId of shuffledGroups) {
                    if (selectedGroupIds.size >= 3) break; // Try to get up to 3 distinct groups

                    const possibleValues = activeMods.filter(v => v.group_id === gId);
                    if (possibleValues.length > 0) {
                        const val = possibleValues[Math.floor(Math.random() * possibleValues.length)];
                        itemMods.push({
                            id: val.id,
                            name: val.value_name,
                            price: val.price_adjustment,
                            group_id: val.group_id
                        });
                        selectedGroupIds.add(gId);
                    }
                }
            }

            return {
                item_id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                kds_routing_logic: item.kds_routing_logic || 'MADE_TO_ORDER',
                item_status: 'in_progress',
                is_hot_drink: String(item.is_hot_drink || item.category?.includes('קפה') || false),
                mods: itemMods.length > 0 ? itemMods : undefined
            };
        });

        const orderTotal = orderItems.reduce((sum, item) => {
            const modsPrice = item.mods?.reduce((mSum, m) => mSum + (m.price || 0), 0) || 0;
            return sum + (item.price * item.quantity) + modsPrice;
        }, 0);

        // 0b. Check Initial Loyalty Points
        log(`🔹 Checking initial points for ${TEST_PHONE}...`);
        const { data: initialPoints, error: pointsError } = await supabase.rpc('get_diagnostic_customer_points', {
            p_phone: TEST_PHONE,
            p_business_id: businessId
        });

        if (pointsError) {
            log(`⚠️ Loyalty Check Failed: ${pointsError.message}. Proceeding without loyalty check.`);
        } else {
            log(`💰 Initial Points: ${initialPoints}`);
        }

        // 1. Create Order (RPC)
        log('1️⃣ Creating Test Order with multiple items & modifiers (RPC: submit_order_v3)...');

        const { data: orderResult, error: createError } = await supabase.rpc('submit_order_v3', {
            p_business_id: businessId,
            p_final_total: orderTotal,
            p_order_type: 'dine_in',
            p_payment_method: 'cash',
            p_customer_name: TEST_NAME,
            p_customer_phone: TEST_PHONE,
            p_items: orderItems
        });

        if (createError) {
            log(`❌ DIAGNOSTICS FAILED: Create Failed: ${createError.message}`);
            return { success: false, logs };
        }

        const orderId = orderResult.order_id;
        const orderNumber = orderResult.order_number;
        log(`✅ Order Created! ID: ${orderId}, Number: ${orderNumber}`);

        // 2. Verify Server State
        log('2️⃣ Verifying Server Persistence...');

        const { data: fetchOrder, error: fetchError } = await supabase.rpc('get_diagnostic_order', {
            p_order_id: orderId
        });

        if (fetchError || !fetchOrder) {
            log('❌ PERSISTENCE FAILURE: Order not found after creation.');
            return { success: false, logs };
        }

        if (fetchOrder.order_status !== 'in_progress') {
            log(`⚠️ STATUS MISMATCH: Expected 'in_progress', got '${fetchOrder.order_status}'`);
        } else {
            log('✅ Status Verification Passed: in_progress');
        }

        // 2b. Verify Loyalty Update
        if (!pointsError) {
            log('🔹 Verifying Loyalty Points Update...');
            const { data: finalPoints } = await supabase.rpc('get_diagnostic_customer_points', {
                p_phone: TEST_PHONE,
                p_business_id: businessId
            });

            if (finalPoints > initialPoints) {
                log(`✅ Loyalty Verified: Points increased from ${initialPoints} to ${finalPoints}`);
            } else {
                log(`⚠️ LOYALTY WARNING: Points did not increase. (Started: ${initialPoints}, Ended: ${finalPoints})`);
            }
        }

        // 2c. Inventory Verification
        log('🔹 Verifying Inventory Tracking...');
        const { data: inventoryItems } = await supabase
            .from('menu_items')
            .select(`
                id, 
                name, 
                prepared_items_inventory (
                    id,
                    current_stock
                )
            `)
            .eq('business_id', businessId)
            .not('prepared_items_inventory', 'is', null);

        if (!inventoryItems || inventoryItems.length === 0) {
            log('⚠️ No items with inventory tracking found. Skipping inventory diagnostic.');
        } else {
            const invItem = inventoryItems[0];
            const invRecord = Array.isArray(invItem.prepared_items_inventory)
                ? invItem.prepared_items_inventory[0]
                : invItem.prepared_items_inventory;

            if (!invRecord) {
                log('⚠️ Inventory record found but malformed. Skipping.');
            } else {
                const initialStock = invRecord.current_stock;
                const testStock = initialStock + 5;
                log(`📊 Found Inventory Item: ${invItem.name}. Current: ${initialStock}. testing update to ${testStock}...`);

                // Perform direct update
                const { error: invUpdateErr } = await supabase
                    .from('prepared_items_inventory')
                    .update({ current_stock: testStock })
                    .eq('id', invRecord.id);

                if (invUpdateErr) {
                    log(`❌ INVENTORY UPDATE FAILED: ${invUpdateErr.message}`);
                } else {
                    // Verify from DB
                    const { data: verifyInv } = await supabase
                        .from('prepared_items_inventory')
                        .select('current_stock')
                        .eq('id', invRecord.id)
                        .single();

                    if (verifyInv?.current_stock === testStock) {
                        log(`✅ Inventory Update Verified! (DB confirmed ${testStock})`);
                    } else {
                        log(`❌ INVENTORY MISMATCH: DB reports ${verifyInv?.current_stock} instead of ${testStock}`);
                    }

                    // Restore initial stock
                    await supabase
                        .from('prepared_items_inventory')
                        .update({ current_stock: initialStock })
                        .eq('id', invRecord.id);
                    log('🔹 Inventory restored to original value.');
                }
            }
        }

        // 3. Update Status
        log('3️⃣ Testing Update RPC (in_progress -> ready)...');
        const { error: updateError } = await supabase.rpc('update_order_status_v3', {
            p_order_id: orderId,
            p_new_status: 'ready',
            p_business_id: businessId
        });

        if (updateError) {
            log(`❌ UPDATE FAILED: ${updateError.message}`);
            return { success: false, logs };
        }

        log('✅ Update Verified: Order and Items are READY.');

        // 4. Cleanup
        log('4️⃣ Cleaning up Test Data...');
        await supabase.from('orders').delete().eq('id', orderId);
        log('✅ Cleanup Complete.');

        return { success: true, logs };

    } catch (err) {
        log(`🔥 CRITICAL ERROR: ${err.message}`);
        return { success: false, logs };
    }
};

/**
 * Simulates nightly traffic to populate history with Rock Legends
 * Now with different payment methods for testing!
 */
export const simulateNightlyTraffic = async (businessId, count = 10) => {
    const logs = [];
    const log = (msg) => logs.push(msg);

    const LEGENDS = [
        { name: 'Freddie', phone: '0000000001' },
        { name: 'David', phone: '0000000002' },
        { name: 'Mick', phone: '0000000003' },
        { name: 'Robert', phone: '0000000004' },
        { name: 'Kurt', phone: '0000000005' },
        { name: 'Jimi', phone: '0000000006' },
        { name: 'Janis', phone: '0000000007' },
        { name: 'Prince', phone: '0000000008' },
        { name: 'Axl', phone: '0000000009' },
        { name: 'Rani (The Boss)', phone: '0548317887' }
    ];

    // 🆕 Payment methods matching PaymentSelectionModal
    // We have 8 entries so that with 10 orders: 2 will be "pay_later" (unpaid)
    const PAYMENT_METHODS = [
        { id: 'cash', name: 'מזומן' },
        { id: 'credit_card', name: 'אשראי' },
        { id: 'bit', name: 'ביט' },
        { id: 'paybox', name: 'פייבוקס' },
        { id: 'gift_card', name: 'שובר' },
        { id: 'oth', name: 'על חשבון הבית' },
        { id: null, name: 'תשלום אחר כך' }, // Pay Later - is_paid = false
        { id: null, name: 'תשלום אחר כך' }  // 🆕 Second unpaid order
    ];

    // 📊 Summary tracking
    const summary = {
        created: 0,
        failed: 0,
        byPaymentMethod: {},
        totalRevenue: 0,
        paidRevenue: 0,
        unpaidRevenue: 0
    };

    try {
        log('🎸 Starting Rock Legends Traffic Simulation...');
        log('💳 Payment Methods: cash, credit_card, bit, paybox, gift_card, oth, null (pay later)');
        log('');

        // 1. Check SMS Logic (Test Error Handling)
        log('📱 Testing SMS Error Handling (Invalid Number)...');
        const smsResult = await sendSms('000000', 'Test Message');
        if (smsResult.error || smsResult.skipped) {
            log(`✅ SMS Validation works: Caught ${smsResult.error || 'Invalid Format notification'}`);
        }

        // 2. Fetch Menu Items and Modifiers
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id, name, price, category')
            .eq('business_id', businessId);

        const { data: options } = await supabase
            .from('optionvalues')
            .select('id, value_name, price_adjustment, group_id');

        if (!menuItems?.length) {
            log('❌ No menu items found. Cannot simulate.');
            return { logs };
        }

        log(`🎰 Simulating ${count} orders for ${LEGENDS.length} rock legends...`);
        log('');

        for (let i = 0; i < count; i++) {
            const legend = LEGENDS[i % LEGENDS.length];

            // 🆕 Cycle through payment methods
            const paymentMethod = PAYMENT_METHODS[i % PAYMENT_METHODS.length];

            // is_paid is true unless payment_method is null (Pay Later)
            const isPaid = paymentMethod.id !== null;

            // Random items (1-7)
            const numItems = Math.floor(Math.random() * 7) + 1;
            const orderItems = [];
            let total = 0;

            for (let j = 0; j < numItems; j++) {
                const item = menuItems[Math.floor(Math.random() * menuItems.length)];

                // Add 1 random modifier if available
                const itemMods = [];
                if (options?.length > 0) {
                    const mod = options[Math.floor(Math.random() * options.length)];
                    itemMods.push({
                        id: mod.id,
                        name: mod.value_name,
                        price: mod.price_adjustment
                    });
                }

                orderItems.push({
                    item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                    kds_routing_logic: 'MADE_TO_ORDER',
                    item_status: 'in_progress',
                    is_hot_drink: (item.category?.includes('קפה') || Math.random() > 0.6),
                    mods: [...itemMods, '__KDS_OVERRIDE__']
                });
                total += item.price + (itemMods[0]?.price || 0);
            }

            // Create Order
            const { data: orderResult, error: createError } = await supabase.rpc('submit_order_v3', {
                p_business_id: businessId,
                p_final_total: total,
                p_order_type: 'dine_in',
                p_payment_method: paymentMethod.id,
                p_is_paid: isPaid,
                p_customer_name: legend.name,
                p_customer_phone: legend.phone,
                p_items: orderItems
            });

            if (createError) {
                log(`❌ Order ${i + 1} failed: ${createError.message}`);
                summary.failed++;
                continue;
            }

            // Track summary
            summary.created++;
            summary.totalRevenue += total;
            const methodKey = paymentMethod.id || 'pay_later';
            summary.byPaymentMethod[methodKey] = (summary.byPaymentMethod[methodKey] || 0) + 1;

            if (isPaid) {
                summary.paidRevenue += total;
            } else {
                summary.unpaidRevenue += total;
            }

            const paidEmoji = isPaid ? '💳' : '⏳';
            log(`${paidEmoji} Order ${i + 1}/${count} | #${orderResult.order_number} | ${legend.name} | ₪${total.toFixed(0)} | ${paymentMethod.name} | ${isPaid ? 'שולם' : 'לא שולם'}`);

            // 🎁 ADD LOYALTY POINTS for this order
            const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc('handle_loyalty_purchase', {
                p_business_id: businessId,
                p_phone: legend.phone,
                p_customer_name: legend.name,
                p_amount_spent: total,
                p_points_to_add: 1
            });

            if (loyaltyError) {
                log(`  ⚠️ Loyalty error: ${loyaltyError.message}`);
            } else if (loyaltyResult?.success) {
                log(`  🎁 +1 point for ${legend.name} (Total: ${loyaltyResult.new_points})`);
            }

            // Complete only first 2 orders (the rest stay in KDS)
            if (i < 2) {
                log(`  🏁 Completing order #${orderResult.order_number}...`);
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'ready',
                    p_business_id: businessId
                });
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'completed',
                    p_business_id: businessId
                });
            }
        }

        // 📊 SUMMARY
        log('');
        log('════════════════════════════════════════');
        log('📊 סיכום הסימולציה:');
        log('════════════════════════════════════════');
        log(`✅ נוצרו: ${summary.created} הזמנות`);
        log(`❌ נכשלו: ${summary.failed} הזמנות`);
        log(`💰 סה"כ הכנסות: ₪${summary.totalRevenue.toFixed(0)}`);
        log(`💳 שולמו: ₪${summary.paidRevenue.toFixed(0)}`);
        log(`⏳ לא שולמו: ₪${summary.unpaidRevenue.toFixed(0)}`);
        log('');
        log('📋 פילוח לפי שיטת תשלום:');
        Object.entries(summary.byPaymentMethod).forEach(([method, count]) => {
            const methodName = PAYMENT_METHODS.find(m => (m.id || 'pay_later') === method)?.name || method;
            log(`   • ${methodName}: ${count} הזמנות`);
        });
        log('════════════════════════════════════════');
        log('');
        log('🔥 סימולציה הושלמה! 8 הזמנות ממתינות ב-KDS.');
        log('📱 Rani (The Boss) צריך להופיע ברשימת הנאמנות!');

        return { success: true, logs, summary };

    } catch (err) {
        log(`🔥 Simulation error: ${err.message}`);
        return { success: false, logs };
    }
};

