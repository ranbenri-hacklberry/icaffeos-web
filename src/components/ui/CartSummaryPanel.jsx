import React from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const CartSummaryPanel = ({ 
  cartItems = [], 
  onUpdateCart, 
  onRemoveItem, 
  className = "" 
}) => {
  const calculateTotal = () => {
    return cartItems?.reduce((total, item) => total + (item?.price * item?.quantity), 0);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    })?.format(price);
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    if (onUpdateCart) {
      onUpdateCart(itemId, newQuantity);
    }
  };

  const handleRemoveItem = (itemId) => {
    if (onRemoveItem) {
      onRemoveItem(itemId);
    }
  };

  const totalAmount = calculateTotal();
  const itemCount = cartItems?.reduce((count, item) => count + item?.quantity, 0);

  return (
    <div className={`bg-card rounded-kiosk shadow-kiosk-lg border border-border ${className}`}>
      {/* Cart Header */}
      <div className="p-4 border-b border-border" dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center">
            <Icon name="ShoppingCart" size={20} className="ml-2" />
            ההזמנה שלי
          </h2>
          {itemCount > 0 && (
            <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded-full">
              {itemCount} פריטים
            </span>
          )}
        </div>
      </div>
      {/* Cart Items */}
      <div className="max-h-96 overflow-y-auto">
        {cartItems?.length === 0 ? (
          <div className="p-6 text-center">
            <Icon name="ShoppingCart" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">ההזמנה ריקה</p>
            <p className="text-sm text-muted-foreground mt-1">
              הוסף פריטים מהתפריט
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {cartItems?.map((item) => (
              <div
                key={item?.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-kiosk animate-slide-in"
                dir="rtl"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-card-foreground truncate">
                    {item?.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item?.price)} × {item?.quantity}
                  </p>
                </div>

                <div className="flex items-center space-x-2 mr-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-1 bg-background rounded-kiosk border border-border">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-8 w-8 p-0 touch-target"
                      onClick={() => handleQuantityChange(item?.id, item?.quantity - 1)}
                    >
                      <Icon name="Minus" size={14} />
                    </Button>
                    
                    <span className="font-mono text-sm font-medium px-2 min-w-[2rem] text-center">
                      {item?.quantity}
                    </span>
                    
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-8 w-8 p-0 touch-target"
                      onClick={() => handleQuantityChange(item?.id, item?.quantity + 1)}
                    >
                      <Icon name="Plus" size={14} />
                    </Button>
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-8 w-8 p-0 text-error hover:bg-error/10 touch-target"
                    onClick={() => handleRemoveItem(item?.id)}
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>

                <div className="text-left">
                  <span className="font-bold font-mono text-success">
                    {formatPrice(item?.price * item?.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Cart Total */}
      {cartItems?.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/20" dir="rtl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-card-foreground">
              סה"כ לתשלום:
            </span>
            <span className="text-2xl font-bold font-mono text-success">
              {formatPrice(totalAmount)}
            </span>
          </div>
          
          <Button
            variant="default"
            size="lg"
            fullWidth
            className="bg-accent hover:bg-accent/90 text-accent-foreground animate-scale-touch touch-target"
            iconName="CreditCard"
            iconPosition="right"
            onClick={() => {
              // Payment initiation logic
              console.log('Initiating payment for:', { cartItems, total: totalAmount });
            }}
          >
            <span className="font-semibold">
              המשך לתשלום ({formatPrice(totalAmount)})
            </span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default CartSummaryPanel;