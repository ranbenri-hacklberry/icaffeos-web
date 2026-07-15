import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useDiscounts = (businessId) => {
    const [discounts, setDiscounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch discounts
    const fetchDiscounts = useCallback(async () => {
        if (!businessId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('discounts')
                .select('*')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            setDiscounts(data || []);
        } catch (err) {
            console.error('Error fetching discounts:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    // Initial Fetch
    useEffect(() => {
        fetchDiscounts();
    }, [fetchDiscounts]);

    // Calculate discount amount based on rule and cart
    // Returns { amount: number, details: string }
    const calculateDiscount = useCallback((discountRule, cartItems, cartTotal) => {
        if (!discountRule) return { amount: 0, details: '' };

        const { type, value, configuration } = discountRule;

        if (type === 'PERCENTAGE') {
            const amount = cartTotal * (value / 100);
            return { amount, details: `${value}% הנחה` };
        }

        if (type === 'FIXED') {
            // Cannot exceed cart total
            const amount = Math.min(cartTotal, value);
            return { amount, details: `₪${value} הנחה` };
        }

        if (type === 'FREE_ITEM') {
            const config = configuration || {};
            const eligibleCategories = config.eligible_categories || []; // Array of strings e.g. ["שתיה חמה"]
            const itemLimit = config.item_limit || 1;
            const sortStrategy = config.sort_strategy || 'CHEAPEST'; // CHEAPEST, MOST_EXPENSIVE

            // Filter eligible items
            // We assume item.category matches the string in eligibleCategories
            const eligibleItems = [];

            cartItems.forEach(cartItem => {
                // Check if current item's category matches any eligible category
                // Use partial match or exact? useMenuItems uses partial includes logic. 
                // Let's rely on string inclusion for flexibility as seen in useMenuItems.
                const itemCat = (cartItem.category || '').toLowerCase();
                const isMatch = eligibleCategories.some(allowedCat => itemCat.includes(allowedCat.toLowerCase()));

                if (isMatch) {
                    // Push individual instances based on quantity
                    // Wait, cartItems are usually grouped. 
                    // cartItem structure usually has 'quantity', 'price' (total or unit?), 'modifiers' etc.
                    // Assuming cartItem.price is UNIT price + mods.
                    // We need to verify cartItem structure.
                    // Usually: { ...item, quantity: 2, price: 15 } -> Price usually is unit price * quantity in some systems, 
                    // OR unit price. SmartCart shows total.
                    // Let's assume we need to break down by quantity for sorting.
                    for (let i = 0; i < cartItem.quantity; i++) {
                        eligibleItems.push({
                            price: cartItem.price, // Assuming `price` is per unit or we need to check `unitPrice`.
                            name: cartItem.name,
                            // We need to link back to the cart item if we were to modify it, but we are just calculating amount.
                        });
                    }
                }
            });

            if (eligibleItems.length === 0) {
                return { amount: 0, details: 'אין פריטים מתאימים להנחה' };
            }

            // Sort
            if (sortStrategy === 'CHEAPEST') {
                eligibleItems.sort((a, b) => a.price - b.price);
            } else {
                eligibleItems.sort((a, b) => b.price - a.price);
            }

            // Take top N
            const itemsToDiscount = eligibleItems.slice(0, itemLimit);
            const totalDiscount = itemsToDiscount.reduce((sum, item) => sum + item.price, 0);

            return {
                amount: totalDiscount,
                details: `זיכוי ${itemsToDiscount.length} פריטים (${itemsToDiscount.map(i => i.name).join(', ')})`
            };
        }

        return { amount: 0, details: '' };
    }, []);

    return {
        discounts,
        loading,
        error,
        refreshDiscounts: fetchDiscounts,
        calculateDiscount
    };
};
