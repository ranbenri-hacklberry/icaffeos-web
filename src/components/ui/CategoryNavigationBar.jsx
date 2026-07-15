import React, { useState } from 'react';
import Button from '@/components/ui/Button';


const CategoryNavigationBar = ({ categories = [], onCategoryChange }) => {
  const [activeCategory, setActiveCategory] = useState('all');

  const defaultCategories = [
    { id: 'all', name: 'הכל', icon: 'Grid3X3' },
    { id: 'burgers', name: 'המבורגרים', icon: 'Beef' },
    { id: 'pizza', name: 'פיצה', icon: 'Pizza' },
    { id: 'salads', name: 'סלטים', icon: 'Salad' },
    { id: 'drinks', name: 'משקאות', icon: 'Coffee' },
    { id: 'desserts', name: 'קינוחים', icon: 'IceCream' }
  ];

  const categoryList = categories?.length > 0 ? categories : defaultCategories;

  const handleCategorySelect = (categoryId) => {
    setActiveCategory(categoryId);
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
          <div className="flex space-x-2 min-w-max" dir="rtl">
            {categoryList?.map((category) => (
              <Button
                key={category?.id}
                variant={activeCategory === category?.id ? "default" : "outline"}
                size="default"
                className={`
                  flex-shrink-0 touch-target animate-scale-touch
                  ${activeCategory === category?.id 
                    ? 'bg-secondary text-secondary-foreground shadow-kiosk' 
                    : 'hover:bg-secondary/10'
                  }
                `}
                iconName={category?.icon}
                iconPosition="right"
                iconSize={18}
                onClick={() => handleCategorySelect(category?.id)}
              >
                <span className="font-medium text-sm px-2">
                  {category?.name}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryNavigationBar;