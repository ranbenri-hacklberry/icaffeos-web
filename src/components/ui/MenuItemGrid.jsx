import React from 'react';
import Button from '@/components/ui/Button';
import Image from '@/components/AppImage';
import Icon from '@/components/AppIcon';

const MenuItemGrid = ({ filteredItems = [], onAddToCart }) => {
  const defaultMenuItems = [
    {
      id: 1,
      name: 'המבורגר קלאסי',
      description: 'המבורגר בקר עסיסי עם ירקות טריים',
      price: 45,
      category: 'burgers',
      image: '/assets/images/burger-classic.jpg',
      available: true
    },
    {
      id: 2,
      name: 'פיצה מרגריטה',
      description: 'פיצה איטלקית עם עגבניות ובזיליקום',
      price: 38,
      category: 'pizza',
      image: '/assets/images/pizza-margherita.jpg',
      available: true
    },
    {
      id: 3,
      name: 'סלט קיסר',
      description: 'סלט עלים ירוקים עם רוטב קיסר',
      price: 32,
      category: 'salads',
      image: '/assets/images/caesar-salad.jpg',
      available: true
    },
    {
      id: 4,
      name: 'קוקה קולה',
      description: 'משקה קל קר ומרענן',
      price: 12,
      category: 'drinks',
      image: '/assets/images/coca-cola.jpg',
      available: true
    },
    {
      id: 5,
      name: 'עוגת שוקולד',
      description: 'עוגת שוקולד עשירה וטעימה',
      price: 28,
      category: 'desserts',
      image: '/assets/images/chocolate-cake.jpg',
      available: true
    },
    {
      id: 6,
      name: 'המבורגר צ\'יזבורגר',
      description: 'המבורגר עם גבינה צהובה מותכת',
      price: 48,
      category: 'burgers',
      image: '/assets/images/cheeseburger.jpg',
      available: true
    }
  ];

  const menuItems = filteredItems?.length > 0 ? filteredItems : defaultMenuItems;

  const handleAddToCart = (item) => {
    if (onAddToCart && item?.available) {
      onAddToCart(item);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    })?.format(price);
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {menuItems?.map((item) => (
          <div
            key={item?.id}
            className={`
              bg-card rounded-kiosk shadow-kiosk hover:shadow-kiosk-lg 
              transition-all duration-200 overflow-hidden
              ${!item?.available ? 'opacity-60' : ''}
            `}
          >
            {/* Item Image */}
            <div className="relative h-48 bg-muted">
              <Image
                src={item?.image}
                alt={item?.name}
                className="w-full h-full object-cover"
              />
              {!item?.available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold bg-error px-3 py-1 rounded-kiosk-sm">
                    לא זמין
                  </span>
                </div>
              )}
            </div>

            {/* Item Details */}
            <div className="p-4" dir="rtl">
              <div className="mb-3">
                <h3 className="font-semibold text-lg text-card-foreground mb-1">
                  {item?.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item?.description}
                </p>
              </div>

              {/* Price and Add Button */}
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-success">
                    {formatPrice(item?.price)}
                  </span>
                </div>
                
                <Button
                  variant={item?.available ? "default" : "outline"}
                  size="sm"
                  disabled={!item?.available}
                  className="animate-scale-touch touch-target"
                  iconName="Plus"
                  iconPosition="left"
                  iconSize={16}
                  onClick={() => handleAddToCart(item)}
                >
                  הוסף
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {menuItems?.length === 0 && (
        <div className="text-center py-12">
          <Icon name="Search" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            לא נמצאו פריטים
          </h3>
          <p className="text-muted-foreground">
            נסה לבחור קטגוריה אחרת
          </p>
        </div>
      )}
    </div>
  );
};

export default MenuItemGrid;