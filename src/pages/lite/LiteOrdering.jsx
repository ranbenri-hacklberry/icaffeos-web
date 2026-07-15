
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/core/store';
import LiteHeader from '@/pages/lite/components/LiteHeader';
import LiteMenuGrid from '@/pages/lite/components/LiteMenuGrid';
import LiteSmartCart from '@/pages/lite/components/LiteSmartCart';
import LiteModifierModal from '@/pages/lite/components/LiteModifierModal';
import LitePaymentModal from '@/pages/lite/components/LitePaymentModal';

const LiteOrdering = () => {
    const { menuItems, fetchMenu, cart, addToCart, removeFromCart, submitOrder, currentUser, logout } = useStore();

    // UI State
    const [selectedItemForMods, setSelectedItemForMods] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchMenu().then(() => setIsLoading(false));
    }, []);

    // Handlers
    const handleAddToCart = useCallback((item) => {
        // ALWAYS Open modifier modal first for simplicity in Lite V1
        // In real app, we check if item has modifiers. 
        // We'll optimistically open it. If no modifiers found (handled in modal), it can auto-confirm or show "Add Note".
        setSelectedItemForMods(item);
    }, []);

    const handleConfirmMods = (modifiers) => {
        if (selectedItemForMods) {
            // Add to cart with modifiers
            // Calculate total price including mods
            const modsPrice = modifiers.reduce((sum, m) => sum + (m.price || 0), 0);
            const finalItem = {
                ...selectedItemForMods,
                price: selectedItemForMods.price + modsPrice, // Update unit price
                originalPrice: selectedItemForMods.price,
                selectedOptions: modifiers, // Format expected by SmartCart
                mods: modifiers // Legacy/Store format support
            };

            addToCart(finalItem);
            setSelectedItemForMods(null);
        }
    };

    const handlePaymentComplete = async (method, { customerName, phoneNumber }) => {
        setShowPaymentModal(false);
        const result = await submitOrder({
            paymentMethod: method,
            customerName,
            phoneNumber
        });

        if (result.success) {
            // Optional: Customize success message if SMS was sent
            if (result.smsResult) {
                alert(`הזמנה בוצעה בהצלחה! ${result.smsResult}`);
            } else {
                // Simple toast or just clear
            }
        } else {
            alert('שגיאה ביצירת הזמנה: ' + result.error);
        }
    };

    if (!currentUser) return <div className="h-screen flex items-center justify-center text-white bg-slate-900">נא להתחבר...</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-900 overflow-hidden font-sans">
            <LiteHeader title="קופה ראשית" />

            <div className="flex-1 flex overflow-hidden">
                {/* Right: Menu Grid (2/3) */}
                <div className="w-[65%] h-full">
                    <LiteMenuGrid
                        items={menuItems}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoading}
                    />
                </div>

                {/* Left: Cart (1/3) */}
                <div className="w-[35%] h-full relative z-10">
                    <LiteSmartCart
                        cart={cart}
                        onRemoveFromCart={removeFromCart}
                        onInitiatePayment={() => setShowPaymentModal(true)}
                    />
                </div>
            </div>

            {/* Modals */}
            {selectedItemForMods && (
                <LiteModifierModal
                    item={selectedItemForMods}
                    onClose={() => setSelectedItemForMods(null)}
                    onConfirm={handleConfirmMods}
                />
            )}

            {showPaymentModal && (
                <LitePaymentModal
                    total={cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0)}
                    onClose={() => setShowPaymentModal(false)}
                    onPaymentComplete={handlePaymentComplete}
                />
            )}
        </div>
    );
};

export default LiteOrdering;
