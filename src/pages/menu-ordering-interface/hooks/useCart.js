import { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const NURSERY_BIZ_ID = '8e4e05da-2d99-4bd9-aedf-8e54cbde930a';

/**
 * Custom hook for cart management
 * Handles cart state, history (undo), and item operations
 */
export const useCart = (initialItems = [], businessId = null) => {
    const [cartItems, setCartItems] = useState(initialItems);
    const [cartHistory, setCartHistory] = useState([]);

    // 🚚 Nursery Specific: Mandatory Delivery Fee Logic
    useEffect(() => {
        if (businessId === NURSERY_BIZ_ID) {
            setCartItems(prev => {
                const hasFee = prev.some(item => item.isDeliveryFee);
                if (hasFee) return prev;

                // Append non-removable delivery fee
                const deliveryFeeItem = {
                    id: 'delivery-fee',
                    name: 'דמי משלוח (משתלה)',
                    price: 30,
                    quantity: 1,
                    isDeliveryFee: true,
                    isNonRemovable: true,
                    tempId: 'delivery-fee-static'
                };
                return [...prev, deliveryFeeItem];
            });
        }
    }, [businessId]);

    // Calculate cart total
    const cartTotal = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }, [cartItems]);

    // Calculate item count
    const itemCount = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }, [cartItems]);

    // Split items into active and delayed
    const activeItems = useMemo(() => cartItems.filter(i => !i.isDelayed), [cartItems]);
    const delayedItems = useMemo(() => cartItems.filter(i => i.isDelayed), [cartItems]);

    // Update cart with history tracking
    const updateCartWithHistory = useCallback((updateFn) => {
        setCartItems((prevItems) => {
            // Save current state to history before updating
            setCartHistory(prev => {
                const newHistory = [...prev, JSON.parse(JSON.stringify(prevItems))];
                return newHistory.slice(-20); // Limit to last 20 actions
            });

            // Apply the update
            return updateFn(prevItems);
        });
    }, []);

    // Undo last cart action
    const handleUndoCart = useCallback(() => {
        if (cartHistory.length === 0) return;

        const previousState = cartHistory[cartHistory.length - 1];
        setCartItems(previousState);
        setCartHistory(prev => prev.slice(0, -1));
        console.log('↩️ Undo: Restored previous cart state');
    }, [cartHistory]);

    // Clear cart
    const clearCart = useCallback(() => {
        setCartItems([]);
        setCartHistory([]);
    }, []);

    // Set cart items (used for edit mode)
    const setItems = useCallback((items) => {
        setCartItems(items);
    }, []);

    // Normalize selected options
    const normalizeSelectedOptions = useCallback((options) => {
        if (!options || typeof options !== 'object') {
            if (Array.isArray(options)) return options;
            return [];
        }
        return Object.values(options)
            .filter(Boolean)
            .sort((a, b) => (a.groupName || '').localeCompare(b.groupName || ''));
    }, []);

    // Get cart item signature for deduplication
    const getCartItemSignature = useCallback((item = {}) => {
        const normalizedOptions = normalizeSelectedOptions(item?.selectedOptions || []);
        return JSON.stringify({
            options: normalizedOptions,
            notes: item?.notes || null
        });
    }, [normalizeSelectedOptions]);

    // Add item to cart
    const addItem = useCallback((item, options = {}) => {
        const normalizedOptions = normalizeSelectedOptions(item?.selectedOptions || options.selectedOptions || []);

        updateCartWithHistory((prevItems) => {
            const candidateItem = {
                ...item,
                selectedOptions: normalizedOptions,
                quantity: item.quantity || 1,
                signature: getCartItemSignature({ ...item, selectedOptions: normalizedOptions }),
                tempId: item.tempId || uuidv4(),
                isDelayed: item.isDelayed || false
            };

            // Always add as new item (no grouping)
            return [...prevItems, candidateItem];
        });
    }, [updateCartWithHistory, normalizeSelectedOptions, getCartItemSignature]);

    // Remove item from cart
    const removeItem = useCallback((itemId, itemSignature, tempId) => {
        updateCartWithHistory((prevItems) => {
            return prevItems.filter(item => {
                // NEVER remove non-removable items (e.g. Delivery Fee)
                if (item.isNonRemovable) return true;

                // Match by tempId first (most reliable)
                if (tempId && item.tempId === tempId) return false;
                // Match by id and signature
                if (item.id === itemId && (item.signature === itemSignature || getCartItemSignature(item) === itemSignature)) {
                    return false;
                }
                return true;
            });
        });
    }, [updateCartWithHistory, getCartItemSignature]);

    // Toggle delay status for item
    const toggleItemDelay = useCallback((itemId, itemSignature, tempId) => {
        updateCartWithHistory(prevItems => {
            return prevItems.map(item => {
                const isMatch = tempId
                    ? item.tempId === tempId
                    : (item.id === itemId && (item.signature === itemSignature || getCartItemSignature(item) === itemSignature));

                if (isMatch) {
                    return { ...item, isDelayed: !item.isDelayed };
                }
                return item;
            });
        });
    }, [updateCartWithHistory, getCartItemSignature]);

    // Update item in cart (after editing)
    const updateItem = useCallback((originalItem, updatedItem) => {
        updateCartWithHistory((prevItems) => {
            return prevItems.map(item => {
                const isMatch = item.tempId
                    ? item.tempId === originalItem.tempId
                    : (item.id === originalItem.id && item.signature === originalItem.signature);

                if (isMatch) {
                    return {
                        ...updatedItem,
                        quantity: item.quantity,
                        signature: getCartItemSignature(updatedItem),
                        tempId: item.tempId || uuidv4(),
                        isDelayed: item.isDelayed,
                        originalStatus: item.originalStatus // Preserve original backend status
                    };
                }
                return item;
            });
        });
    }, [updateCartWithHistory, getCartItemSignature]);

    return {
        // State
        cartItems,
        cartHistory,
        cartTotal,
        itemCount,
        activeItems,
        delayedItems,

        // Actions
        addItem,
        removeItem,
        updateItem,
        toggleItemDelay,
        clearCart,
        setItems,
        handleUndoCart,
        updateCartWithHistory,

        // Utilities
        normalizeSelectedOptions,
        getCartItemSignature
    };
};

export default useCart;
