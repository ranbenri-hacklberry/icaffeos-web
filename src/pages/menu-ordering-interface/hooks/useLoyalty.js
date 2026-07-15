import { useState, useEffect, useMemo, useCallback } from 'react';
import { getLoyaltyCount } from '../../../lib/loyalty';

/**
 * Custom hook for loyalty management
 * Handles loyalty points, free coffees, and discount calculations
 */
export const useLoyalty = ({
    currentCustomer,
    currentUser,
    cartItems,
    isEditMode = false,
    editingOrderData = null
}) => {
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [loyaltyFreeCoffees, setLoyaltyFreeCoffees] = useState(0);
    const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
    const [loyaltyFreeItemsCount, setLoyaltyFreeItemsCount] = useState(0);

    // Fetch loyalty count when customer changes
    useEffect(() => {
        const fetchLoyalty = async () => {
            const phoneNumber = currentCustomer?.phone_number || currentCustomer?.phone;
            if (phoneNumber) {
                // OPTIMISTIC: Set points from currentCustomer if available before fetching
                if (currentCustomer.loyalty_coffee_count !== undefined) {
                    setLoyaltyPoints(currentCustomer.loyalty_coffee_count);
                    console.log('✨ Optimistic loyalty set:', currentCustomer.loyalty_coffee_count);
                }

                try {
                    const { points, freeCoffees } = await getLoyaltyCount(phoneNumber, currentUser);
                    setLoyaltyPoints(points);
                    setLoyaltyFreeCoffees(freeCoffees);
                    console.log('🎁 Fetched loyalty:', { points, freeCoffees }, 'for phone:', phoneNumber);
                } catch (error) {
                    console.error('Failed to fetch loyalty:', error);
                    // Don't reset to 0 if we have optimistic points
                    if (currentCustomer.loyalty_coffee_count === undefined) {
                        setLoyaltyPoints(0);
                    }
                    setLoyaltyFreeCoffees(0);
                }
            } else {
                setLoyaltyPoints(0);
                setLoyaltyFreeCoffees(0);
            }
        };
        fetchLoyalty();
    }, [currentCustomer, currentUser]);

    // Calculate adjusted loyalty points for edit mode
    // Only subtract original coffees if the order was already paid (loyalty was already processed)
    const adjustedLoyaltyPoints = useMemo(() => {
        if (!isEditMode || !editingOrderData?.isPaid) return loyaltyPoints;

        // Subtract coffees that were already counted in this order
        const originalCoffeeCount = editingOrderData.originalItems
            ?.filter(i => i.is_hot_drink)
            ?.reduce((sum, i) => sum + i.quantity, 0) || 0;

        return Math.max(0, loyaltyPoints - originalCoffeeCount);
    }, [loyaltyPoints, isEditMode, editingOrderData]);

    // Memoize coffee items to avoid recalculating on every render
    const coffeeItems = useMemo(() =>
        cartItems.filter(item => item.is_hot_drink),
        [cartItems]
    );

    // Calculate discount based on cart items and loyalty
    useEffect(() => {
        // Calculate how many free coffees the customer can redeem
        // Use the pre-calculated free_coffees from the database (updated when points reach 10)
        const effectivePoints = isEditMode ? adjustedLoyaltyPoints : loyaltyPoints;
        // FIX: Use loyaltyFreeCoffees from DB, plus any additional from current points
        let freeItemsCount = loyaltyFreeCoffees + Math.floor(effectivePoints / 10);

        // DEBUG: Log values to understand why discount might not apply
        // [CLEANED] console.log('🔍 [useLoyalty] Discount calculation:', {
        // [CLEANED]         loyaltyFreeCoffees,
        // [CLEANED]         loyaltyPoints,
        // [CLEANED]         effectivePoints,
        // [CLEANED]         freeItemsCount,
        // [CLEANED]         coffeeItemsCount: coffeeItems.length,
        // [CLEANED]         coffeeItems: coffeeItems.map(c => ({ name: c.name, is_hot_drink: c.is_hot_drink, price: c.price }))
        // [CLEANED]     });

        // In edit mode with original discount, PRESERVE the original discount
        if (isEditMode && editingOrderData?.originalLoyaltyDiscount > 0) {
            setLoyaltyDiscount(editingOrderData.originalLoyaltyDiscount);
            setLoyaltyFreeItemsCount(editingOrderData.originalRedeemedCount || 0);
            console.log('🎁 Preserving original discount in edit mode:', editingOrderData.originalLoyaltyDiscount);
            return;
        }

        let discount = 0;

        if (freeItemsCount > 0 && coffeeItems.length > 0) {
            // Sort cart items by price (ascending) to discount the cheapest ones first
            const sortedCoffees = [...coffeeItems].sort((a, b) => a.price - b.price);

            // Take the cheapest 'freeItemsCount' items (but not more than what's in cart)
            const itemsToDiscount = Math.min(freeItemsCount, sortedCoffees.length);
            for (let i = 0; i < itemsToDiscount; i++) {
                discount += sortedCoffees[i].price;
            }

            console.log('🎁 Applying discount:', {
                freeItemsCount,
                itemsToDiscount,
                discountedItems: sortedCoffees.slice(0, itemsToDiscount).map(c => c.price),
                totalDiscount: discount
            });
        }

        setLoyaltyDiscount(discount);
        setLoyaltyFreeItemsCount(freeItemsCount);
    }, [coffeeItems, loyaltyPoints, loyaltyFreeCoffees, isEditMode, editingOrderData, adjustedLoyaltyPoints]);

    // Refresh loyalty data
    const refreshLoyalty = useCallback(async (phone) => {
        if (!phone) return { points: 0, freeCoffees: 0 };

        try {
            const { points, freeCoffees } = await getLoyaltyCount(phone, currentUser);
            setLoyaltyPoints(points);
            setLoyaltyFreeCoffees(freeCoffees);
            return { points, freeCoffees };
        } catch (error) {
            console.error('Failed to refresh loyalty:', error);
            return { points: 0, freeCoffees: 0 };
        }
    }, [currentUser]);

    return {
        // State
        loyaltyPoints,
        loyaltyFreeCoffees,
        loyaltyDiscount,
        loyaltyFreeItemsCount,
        adjustedLoyaltyPoints,

        // Actions
        setLoyaltyPoints,
        setLoyaltyFreeCoffees,
        setLoyaltyDiscount,
        setLoyaltyFreeItemsCount,
        refreshLoyalty
    };
};

export default useLoyalty;
