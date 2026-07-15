import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { InventoryItem, ReceivingSession, ReceivingSessionItem } from '@/pages/ipad_inventory/types';

const parseCaseQuantityFromName = (name: string, matchedItem: any) => {
    let caseQuantity = matchedItem?.case_quantity || 1;
    if (caseQuantity === 1 && matchedItem && (matchedItem.unit === 'יח׳' || matchedItem.unit === 'יחידה' || matchedItem.unit === 'יח') && !(Number(matchedItem.weight_per_unit) > 0)) {
        const parsedCaseMatch = name.match(/\b(?:l|m)?(\d{1,2})\b/i);
        if (parsedCaseMatch) {
            const parsedVal = parseInt(parsedCaseMatch[1]);
            if (parsedVal > 1) {
                caseQuantity = parsedVal;
            }
        }
    }
    return caseQuantity;
};

export const useTripleCheckSession = (items: InventoryItem[], businessId?: string) => {
    const [session, setSession] = useState<ReceivingSession | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const initializeSession = useCallback((ocrData: any, orderId: string | null = null, supplierId: string | null = null) => {
        if (!ocrData) return;

        const itemsList = ocrData.items || [];
        const unmatchedList = ocrData.unmatched_items || [];

        const sessionItems: ReceivingSessionItem[] = [
            ...itemsList.map((ocrItem: any) => {
                const name = ocrItem.name || ocrItem.description || 'פריט ללא שם';
                const invoicedQty = ocrItem.quantity || ocrItem.amount || 0;
                const unitPrice = ocrItem.price || ocrItem.cost_per_unit || 0;

                const matchedItem = items.find(inv =>
                    inv.id === ocrItem.inventory_item_id ||
                    inv.name.toLowerCase() === name.toLowerCase() ||
                    inv.name.includes(name) ||
                    name.includes(inv.name) ||
                    (Array.isArray(inv.supplier_product_name) && inv.supplier_product_name.some((alias: string) => 
                        alias.toLowerCase().trim() === name.toLowerCase().trim()
                    ))
                );

                return {
                    id: ocrItem.id || `temp-${Date.now()}-${Math.random()}`,
                    name,
                    unit: ocrItem.unit || matchedItem?.unit || 'יח׳',
                    invoicedQty,
                    orderedQty: invoicedQty, // If from OCR, we assume invoiced = ordered for matching
                    actualQty: invoicedQty,
                    unitPrice,
                    countStep: matchedItem?.count_step || 1,
                    inventoryItemId: ocrItem.inventory_item_id || matchedItem?.id || null,
                    catalogItemId: matchedItem?.catalog_item_id || null,
                    isNew: !matchedItem,
                    matchedItem,
                    caseQuantity: parseCaseQuantityFromName(name, matchedItem)
                };
            }),
            ...unmatchedList.map((ocrItem: any) => {
                const name = ocrItem.raw_name || ocrItem.name || 'פריט חדש';
                const invoicedQty = ocrItem.quantity || ocrItem.amount || 0;
                const unitPrice = ocrItem.price || ocrItem.cost_per_unit || 0;

                const matchedItem = items.find(inv =>
                    inv.name.toLowerCase() === name.toLowerCase() ||
                    inv.name.includes(name) ||
                    name.includes(inv.name) ||
                    (Array.isArray(inv.supplier_product_name) && inv.supplier_product_name.some((alias: string) => 
                        alias.toLowerCase().trim() === name.toLowerCase().trim()
                    ))
                );

                return {
                    id: ocrItem.id || `temp-unmatched-${Date.now()}-${Math.random()}`,
                    name,
                    unit: ocrItem.unit || matchedItem?.unit || 'יח׳',
                    invoicedQty,
                    orderedQty: invoicedQty,
                    actualQty: invoicedQty,
                    unitPrice,
                    countStep: matchedItem?.count_step || 1,
                    inventoryItemId: matchedItem?.id || null,
                    catalogItemId: matchedItem?.catalog_item_id || null,
                    isNew: !matchedItem,
                    matchedItem,
                    caseQuantity: parseCaseQuantityFromName(name, matchedItem)
                };
            })
        ];

        setSession({
            items: sessionItems,
            orderId,
            supplierId: supplierId || ocrData.supplier_id || null,
            hasInvoice: true,
            totalInvoiced: ocrData.total_amount || sessionItems.reduce((sum, i) => sum + (i.invoicedQty! * i.unitPrice), 0)
        });
    }, [items]);

    const initializeFromOrder = useCallback((order: any) => {
        if (!order?.items) return;

        const sessionItems: ReceivingSessionItem[] = order.items.map((orderItem: any, idx: number) => {
            const matchedItem = items.find(inv =>
                inv.name.toLowerCase() === (orderItem.name || '').toLowerCase()
            );

            return {
                id: orderItem.id || `order-item-${idx}-${Date.now()}`,
                name: orderItem.name || 'פריט ללא שם',
                unit: orderItem.unit || matchedItem?.unit || 'יח׳',
                invoicedQty: null,
                orderedQty: orderItem.qty || 0,
                actualQty: orderItem.qty || 0,
                unitPrice: orderItem.price || matchedItem?.cost_per_unit || 0,
                countStep: matchedItem?.count_step || 1,
                inventoryItemId: matchedItem?.id || null,
                catalogItemId: matchedItem?.catalog_item_id || null,
                isNew: !matchedItem,
                matchedItem
            };
        });

        setSession({
            items: sessionItems,
            orderId: order.id,
            supplierId: order.supplier_id || null,
            supplierName: order.supplier_name,
            hasInvoice: false,
            totalInvoiced: 0
        });
    }, [items]);

    const updateActualQty = (itemId: string, newQty: number) => {
        setSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? { ...item, actualQty: newQty } : item
                )
            };
        });
    };

    const confirmReceipt = async () => {
        if (!session || !businessId) return { success: false, error: 'No session' };

        setIsConfirming(true);
        try {
            const rpcItems = session.items
                .filter(item => item.actualQty > 0)
                .map(item => {
                    let actualQty = item.actualQty;
                    let invoicedQty = item.invoicedQty ?? item.actualQty;
                    let unitPrice = item.unitPrice;

                    const dbUnit = item.matchedItem?.unit;
                    let wpu = parseFloat(item.matchedItem?.weight_per_unit as any) || 0;
                    if (wpu === 0 && dbUnit === 'גרם') {
                        // Try to parse weight from invoice item name (e.g. "עלית שוקולית 850ג" -> 850)
                        const nameLower = (item.name || '').toLowerCase();
                        const matchGrams = nameLower.match(/(\d+)\s*(?:ג|g)\b/);
                        if (matchGrams) {
                            wpu = parseFloat(matchGrams[1]);
                        } else {
                            const matchKg = nameLower.match(/(\d+(?:\.\d+)?)\s*(?:ק"ג|קג|kg)\b/);
                            if (matchKg) {
                                wpu = parseFloat(matchKg[1]) * 1000;
                            }
                        }
                    }

                    const invUnit = (item.unit || '').toLowerCase().trim();

                    const isKg = invUnit.includes('קג') || invUnit.includes('ק"ג') || invUnit.includes('kg');
                    const isUnit = invUnit.includes('יח') || invUnit.includes('יחיד') || invUnit.includes('unit') || invUnit.includes('מארז') || invUnit.includes('קופס');

                    if (dbUnit === 'גרם') {
                        if (isKg) {
                            // Convert Kg to grams (e.g. 2 kg -> 2000 grams)
                            actualQty = actualQty * 1000;
                            invoicedQty = invoicedQty * 1000;
                            unitPrice = unitPrice / 1000;
                        } else if (isUnit && wpu > 0) {
                            // Convert Units to grams (e.g. 2 units of 100g -> 200 grams)
                            actualQty = actualQty * wpu;
                            invoicedQty = invoicedQty * wpu;
                            unitPrice = unitPrice / wpu;
                        }
                    } else if (dbUnit === 'יח׳' || dbUnit === 'יחידה' || dbUnit === 'יח') {
                        if (isKg && wpu > 0) {
                            // Convert Kg to Units (e.g. 2 kg / 0.1 kg per cucumber = 20 cucumbers) and round
                            actualQty = Math.round(actualQty * (1000 / wpu));
                            invoicedQty = Math.round(invoicedQty * (1000 / wpu));
                            unitPrice = unitPrice * (wpu / 1000);
                        } else {
                            const caseQty = parseInt(item.matchedItem?.case_quantity as any) || 1;
                            if (caseQty > 1) {
                                // Multiply by case quantity (e.g. 1 tray of 30 -> 30 units)
                                actualQty = actualQty * caseQty;
                                invoicedQty = invoicedQty * caseQty;
                                unitPrice = unitPrice / caseQty;
                            }
                        }
                    }

                    return {
                        inventory_item_id: item.inventoryItemId || null,
                        catalog_item_id: item.catalogItemId || null,
                        actual_qty: actualQty,
                        invoiced_qty: invoicedQty,
                        unit_price: unitPrice
                    };
                });

            const { data, error } = await supabase.rpc('receive_inventory_shipment', {
                p_items: rpcItems,
                p_order_id: session.orderId,
                p_supplier_id: session.supplierId,
                p_notes: null,
                p_business_id: businessId
            });

            if (error) throw error;

            // Save matched item names to supplier_product_name aliases in the database
            try {
                const mapPromises = session.items
                    .filter(item => item.inventoryItemId && item.name)
                    .map(item => 
                        supabase.rpc('append_supplier_name', {
                            p_item_id: Number(item.inventoryItemId),
                            p_new_name: item.name
                        })
                    );
                await Promise.all(mapPromises);
                console.log('✅ Supplier product mappings successfully saved.');
            } catch (mapErr) {
                console.error('⚠️ Warning: Failed to save some supplier product mappings:', mapErr);
            }

            setSession(null);
            return { success: true, data };
        } catch (err: any) {
            console.error('Error confirming receipt:', err);
            return { success: false, error: err.message };
        } finally {
            setIsConfirming(false);
        }
    };

    const updateMatchedItem = useCallback((itemId: string, inventoryItemId: number) => {
        setSession(prev => {
            if (!prev) return null;
            const targetInvItem = items.find(inv => inv.id === inventoryItemId);
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId
                        ? {
                              ...item,
                              inventoryItemId: inventoryItemId,
                              catalogItemId: targetInvItem?.catalog_item_id || null,
                              matchedItem: targetInvItem,
                              isNew: false,
                              caseQuantity: targetInvItem?.case_quantity || 1
                          }
                        : item
                )
            };
        });
    }, [items]);

    const updateCaseQuantity = useCallback((itemId: string, caseQty: number) => {
        setSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId
                        ? { ...item, caseQuantity: Math.max(1, caseQty) }
                        : item
                )
            };
        });
    }, []);

    return {
        session,
        isConfirming,
        initializeSession,
        initializeFromOrder,
        updateActualQty,
        updateMatchedItem,
        updateCaseQuantity,
        confirmReceipt,
        clearSession: () => setSession(null)
    };
};
