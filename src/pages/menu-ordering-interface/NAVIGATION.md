# Menu Ordering Interface - Code Organization Guide

## 🎯 Quick Navigation (Use Ctrl+F / Cmd+F)

### Section Markers to Search For

| Section | Search Term |
|---------|-------------|
| State Declarations | `// #region STATE` |
| Edit Mode Logic | `// --- Edit Mode Logic ---` |
| Loyalty Calculation | `// SIMPLE LOYALTY CALCULATION` |
| Cart Handlers | `handleAddItemWithModifiers` |
| Order Submission | `handleInitiatePayment` |
| Payment Processing | `handlePaymentConfirm` |
| Cleanup/Reset | `handleCloseConfirmation` |

## 📁 File Structure

```
/pages/menu-ordering-interface/
├── index.jsx           # Main component (~2600 lines)
├── hooks/
│   ├── useLoyalty.js   # Loyalty points & discounts
│   ├── useCart.js      # Cart state management
│   └── useMenuItems.js # Menu fetching
└── components/
    ├── SmartCart.jsx   # Cart display
    ├── MenuGrid.jsx    # Menu items grid
    ├── PaymentSelectionModal.jsx
    └── ModifierModal.jsx
```

## 💰 Loyalty System Flow

```
1. Customer enters phone → getLoyaltyCount() fetches points
2. Points displayed in SmartCart badge
3. If points >= 10 OR free_coffees > 0 → discount applied
4. On order submit → addCoffeePurchase() called
5. DB function handle_loyalty_purchase() updates:
   - points_balance
   - free_coffees
   - loyalty_transactions (log)
```

## 🐛 Common Debugging

- **Loyalty not updating?** Check Console for `📞 [Loyalty] Calling handle_loyalty_purchase`
- **Wrong business?** Check `business_id` in Console logs
- **Discount not applying?** Check `🔍 [useLoyalty] Discount calculation:` log
