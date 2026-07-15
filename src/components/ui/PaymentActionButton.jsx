import React from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const PaymentActionButton = ({ 
  cartTotal = 0, 
  cartItems = [], 
  onInitiatePayment,
  disabled = false,
  className = ""
}) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    })?.format(price);
  };

  const handlePaymentClick = () => {
    if (onInitiatePayment && cartItems?.length > 0 && cartTotal > 0) {
      const orderData = {
        items: cartItems,
        total: cartTotal,
        timestamp: new Date()?.toISOString(),
        orderNumber: `ORD-${Date.now()}`
      };
      onInitiatePayment(orderData);
    }
  };

  const isDisabled = disabled || cartItems?.length === 0 || cartTotal <= 0;
  const itemCount = cartItems?.reduce((count, item) => count + item?.quantity, 0);

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      {/* Order Summary */}
      {cartItems?.length > 0 && (
        <div className="bg-muted/30 rounded-kiosk p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {itemCount} פריטים בהזמנה
            </span>
            <span className="font-medium text-card-foreground">
              {formatPrice(cartTotal)}
            </span>
          </div>
        </div>
      )}
      {/* Payment Button */}
      <Button
        variant="default"
        size="xl"
        fullWidth
        disabled={isDisabled}
        className={`
          ${isDisabled 
            ? 'bg-muted text-muted-foreground cursor-not-allowed' 
            : 'bg-accent hover:bg-accent/90 text-accent-foreground animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg'
          }
          touch-target transition-all duration-200 font-semibold text-lg
        `}
        iconName={isDisabled ? "ShoppingCart" : "CreditCard"}
        iconPosition="right"
        iconSize={20}
        onClick={handlePaymentClick}
      >
        {isDisabled ? (
          <span>הוסף פריטים להזמנה</span>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span>המשך לתשלום</span>
            <span className="font-mono text-xl">
              {formatPrice(cartTotal)}
            </span>
          </div>
        )}
      </Button>
      {/* Payment Methods Info */}
      {!isDisabled && (
        <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Icon name="CreditCard" size={14} />
            <span>כרטיס אשראי</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Smartphone" size={14} />
            <span>תשלום נייד</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Banknote" size={14} />
            <span>מזומן</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentActionButton;