import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  X, Check, Coffee, Milk, Leaf, Wheat, Nut,
  Cloud, CloudOff, Thermometer, Flame, Droplets,
  Zap, Ban, Puzzle, ArrowUpFromLine, ArrowDownToLine, Blend, Gauge, Apple, Disc,
  Plus, Minus, Package, ChefHat, Camera, Loader2, CheckCircle2, AlertCircle,
  Pencil, Save, ImagePlus, Sparkles, RotateCcw, Trash2,
  CircleDot, Wine, GlassWater,
  ClipboardList, Settings, Search, BookOpen, ChevronDown
} from 'lucide-react';
import { fetchManagerItemOptions, clearOptionsCache } from '@/lib/managerApi';
import { useProductTraining } from '@/hooks/useProductTraining';
import PinCodeModal from '@/components/PinCodeModal';
import { supabase } from '@/lib/supabase';
import EditRecipePanel from './EditRecipePanel';
import EditTrainingPanel from './EditTrainingPanel';
import EditAdvancedPanel from './EditAdvancedPanel';

const formatPrice = (price = 0) => {
  const numPrice = Number(price);
  return numPrice > 0 ? `+${numPrice}₪` : '';
};

// Helper function to get icon based on value name
const getIconForValue = (valueName, groupName) => {
  const name = (valueName || '').toLowerCase();
  const group = (groupName || '').toLowerCase();

  // Milk icons
  if (group.includes('חלב') || group.includes('milk')) {
    if (name.includes('סויה')) return Leaf;
    if (name.includes('שיבולת')) return Wheat;
    if (name.includes('שקדים')) return Nut;
    return Milk;
  }

  // Foam icons
  if (group.includes('קצף') || group.includes('foam')) {
    if (name.includes('הרבה') || name.includes('extra')) return ArrowUpFromLine;
    if (name.includes('מעט') || name.includes('little')) return ArrowDownToLine;
    if (name.includes('בלי') || name.includes('none')) return X;
    return Cloud;
  }

  // Temperature icons
  if (group.includes('טמפרטורה') || group.includes('temp')) {
    if (name.includes('רותח') || name.includes('hot')) return Flame;
    if (name.includes('פושר') || name.includes('warm')) return Thermometer;
    return Thermometer;
  }

  // Base icons
  if (group.includes('בסיס') || group.includes('base')) {
    if (name.includes('מים') || name.includes('water')) return Droplets;
    if (name.includes('חצי')) return Blend;
    return Droplets;
  }

  // Strength icons
  if (group.includes('חוזק') || group.includes('strength')) {
    if (name.includes('חזק') || name.includes('strong')) return Gauge;
    if (name.includes('חלש') || name.includes('weak')) return Coffee;
    return Zap;
  }

  // Topping icons (for pizza/toast)
  const groupLower = group.toLowerCase();
  if (groupLower.includes('תוספות') || groupLower.includes('topping')) {
    if (name.includes('עגבניות') || name.includes('tomato')) return Apple;
    if (name.includes('זיתים') || name.includes('olive')) return Disc;
    if (name.includes('בצל') || name.includes('onion')) return Disc;
    return Disc;
  }

  // Snack / Food icons
  if (name.includes('צ\'יפס') || name.includes('chips')) return Flame;
  if (name.includes('טבעות בצל') || name.includes('onion ring')) return CircleDot;
  if (name.includes('אדממה') || name.includes('edamame')) return Leaf;

  // Alcohol / Spirit icons
  if (name.includes('עראק') || name.includes('arak')) return Wine;
  if (name.includes('רום') || name.includes('rum')) return GlassWater;

  // Special icons
  if (name.includes('נטול')) return Ban;
  if (name.includes('מפורק')) return Puzzle;

  return Coffee;
};

// Milk Card Component (Hero Section)
const MilkCard = ({ label, Icon, price, isSelected, onClick, emoji }) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex-1 flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
        font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
        ${isSelected
          ? "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100"
          : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md"
        }
      `}
    >
      {emoji ? (
        <span className={`text-2xl transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}>{emoji}</span>
      ) : (
        <Icon
          size={24}
          strokeWidth={isSelected ? 2.5 : 2}
          className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}
        />
      )}
      <span className="text-sm">{label}</span>
      {price > 0 && (
        <span className={`text-xs font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
          +₪{price}
        </span>
      )}
    </button>
  );
};

// Modifier Pill Button
const ModifierPill = ({ label, Icon, isSelected, onClick, variant = "default", price, emoji }) => {
  const selectedStyles =
    variant === "purple"
      ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
      : "bg-slate-800 text-white shadow-lg shadow-slate-300";

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl
        font-medium transition-all duration-200 touch-manipulation active:scale-95
        ${isSelected
          ? selectedStyles
          : "bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50"
        }
      `}
    >
      {emoji ? (
        <span className="text-lg">{emoji}</span>
      ) : (
        <Icon size={18} strokeWidth={isSelected ? 2.5 : 2} />
      )}
      <span className="text-sm">{label}</span>
      {price !== undefined && price > 0 && (
        <span className={`text-xs ${isSelected ? "text-white/80" : "text-slate-400"}`}>
          +₪{price}
        </span>
      )}
    </button>
  );
};

// Training Camera Preview — polls /camera/snapshot with digital zoom
const ZOOM_FACTOR = 3.0; // 3x center crop zoom — tight focus on product
const TrainingCameraPreview = ({ isActive }) => {
  const canvasRef = useRef(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    // Reset on each activation to prevent stale state
    fetchingRef.current = false;

    const tick = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const res = await fetch('/edge-node/camera/snapshot', { cache: 'no-store' });
        if (!res.ok) { fetchingRef.current = false; return; }
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const canvas = canvasRef.current;
        if (canvas) {
          const cropW = bmp.width / ZOOM_FACTOR;
          const cropH = bmp.height / ZOOM_FACTOR;
          const cropX = (bmp.width - cropW) / 2;
          const cropY = (bmp.height - cropH) / 2;
          canvas.width = Math.round(cropW);
          canvas.height = Math.round(cropH);
          canvas.getContext('2d').drawImage(bmp, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        }
        bmp.close();
      } catch (e) {
        console.warn('[TrainingCamera] fetch error:', e.message);
      } finally {
        fetchingRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, 150); // ~7 FPS
    return () => { clearInterval(id); fetchingRef.current = false; };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        borderRadius: 12,
        background: '#0f172a',
      }}
    />
  );
};

const GROUP_TEMPLATES = [
  { icon: '🥛', name: 'סוג חלב', type: 'replacement', requirement: 'M' },
  { icon: '☕', name: 'סוג קפה', type: 'replacement', requirement: 'M' },
  { icon: '💪', name: 'חוזק', type: 'replacement', requirement: 'O' },
  { icon: '🌡️', name: 'טמפרטורה', type: 'replacement', requirement: 'O' },
  { icon: '🫧', name: 'קצף', type: 'replacement', requirement: 'O' },
  { icon: '🍽️', name: 'הגשה', type: 'replacement', requirement: 'O' },
  { icon: '🧊', name: 'בסיס', type: 'replacement', requirement: 'O' },
  { icon: '➕', name: 'תוספות', type: 'additive', requirement: 'O' },
  { icon: '✏️', name: 'מותאם אישית', type: 'replacement', requirement: 'O' },
];

// ── Auto Icon Detection ──
// Comprehensive keyword → emoji mapping for automatic icon assignment
const ICON_MAP = [
  // Dairy & Milk
  ['🥛', ['חלב', 'milk', 'רגיל חלב']],
  ['⬜', ['בולגרית', 'קוטג', 'cottage', 'לבנה', 'labneh', 'פטה', 'feta', 'טבעוני גבינה']],
  ['🧀', ['גבינה', 'cheese', 'מוצרלה', 'mozzarella', 'פרמזן', 'parmesan', 'צהובה', 'גאודה', 'עיזים', 'שמנת', 'cream']],
  ['🫛', ['סויה', 'soy', 'אדממה', 'edamame']],
  ['🌾', ['שיבולת', 'oat', 'שיבולת שועל']],
  ['🥥', ['קוקוס', 'coconut']],
  ['🌰', ['שקדים', 'almond', 'אגוז לוז', 'hazelnut', 'פקאן', 'pecan', 'קשיו', 'cashew']],
  ['🧈', ['חמאה', 'butter', 'מרגרינה']],
  ['🍦', ['גלידה', 'ice cream', 'סורבה', 'sorbet', 'פרוזן']],
  
  // Coffee & Hot Drinks
  ['☕', ['קפה', 'coffee', 'אספרסו', 'espresso', 'הפוך', 'קפוצ', 'לאטה', 'latte', 'מקיאטו', 'macchiato', 'אמריקנו', 'americano', 'נס', 'instant', 'נטול', 'decaf', 'קפאין', 'caffeine', 'טורקי', 'turkish']],
  ['🫖', ['תה', 'tea', 'חליטה', 'infusion', 'צמחים']],
  ['🍵', ['מאצ\'ה', 'matcha']],
  ['🧋', ['אייס', 'iced', 'קולד ברו', 'cold brew', 'פרפה']],
  
  // Cold Drinks
  ['🥤', ['שייק', 'shake', 'סמוזי', 'smoothie', 'מילקשייק']],
  ['🧃', ['מיץ', 'juice', 'תפוזים', 'לימונדה', 'lemonade', 'לימונענע']],
  ['🫗', ['מים', 'water', 'סודה', 'soda', 'טוניק', 'tonic']],
  ['🍺', ['בירה', 'beer', 'לאגר', 'אייל', 'ale']],
  ['🍷', ['יין', 'wine', 'אדום', 'לבן', 'רוזה']],
  ['🥂', ['שמפניה', 'champagne', 'פרוסקו', 'prosecco', 'משקה חגיגי']],
  ['🍹', ['קוקטייל', 'cocktail', 'מוחיטו', 'mojito', 'סנגריה']],
  ['🥃', ['וויסקי', 'whisky', 'ויסקי', 'bourbon', 'ברנדי', 'brandy']],
  
  // Bread & Bakery
  ['🍞', ['לחם', 'bread', 'טוסט', 'toast', 'פרוסה', 'slice']],
  ['🥐', ['קרואסון', 'croissant']],
  ['🥯', ['בייגל', 'bagel', 'בייגלה']],
  ['🫓', ['פיתה', 'pita', 'לאפה', 'laffa', 'טורטייה', 'tortilla', 'לחמנייה', 'wrap', 'ראפ']],
  ['🥖', ['באגט', 'baguette', 'צרפתי', 'french']],
  ['🧇', ['וופל', 'waffle']],
  ['🥞', ['פנקייק', 'pancake', 'קרפ', 'crepe', 'בלינצ']],
  ['🥨', ['פרצל', 'pretzel']],
  
  // Main Dishes
  ['🍕', ['פיצה', 'pizza']],
  ['🍔', ['המבורגר', 'burger', 'המבורג']],
  ['🌭', ['נקניקיה', 'hot dog', 'הוט דוג', 'נקניק', 'sausage']],
  ['🌮', ['טאקו', 'taco']],
  ['🌯', ['בוריטו', 'burrito']],
  ['🥪', ['סנדוויץ', 'sandwich', 'כריך', 'פנינו', 'panini']],
  ['🥙', ['שווארמה', 'shawarma', 'פלאפל', 'falafel', 'קבב', 'kebab']],
  ['🧆', ['פלאפל', 'falafel', 'כדור']],
  ['🍗', ['עוף', 'chicken', 'שניצל', 'schnitzel', 'כנפיים', 'wings']],
  ['🥩', ['סטייק', 'steak', 'בשר', 'meat', 'בקר', 'beef', 'אנטריקוט', 'entrecote']],
  ['🐟', ['דג', 'fish', 'סלמון', 'salmon', 'טונה', 'tuna', 'סשימי', 'sashimi']],
  ['🍣', ['סושי', 'sushi', 'מאקי', 'maki', 'ניגירי']],
  ['🍝', ['פסטה', 'pasta', 'ספגטי', 'spaghetti', 'פנה', 'penne', 'רביולי', 'ravioli', 'ניוקי', 'gnocchi']],
  ['🍲', ['מרק', 'soup', 'תבשיל', 'stew', 'נזיד']],
  ['🍳', ['ביצה', 'egg', 'חביתה', 'omelette', 'עין', 'שקשוקה', 'shakshuka']],
  ['🥘', ['טאג\'ין', 'tagine', 'קדירה', 'casserole']],
  
  // Vegetables
  ['🍅', ['עגבניה', 'tomato', 'עגבני']],
  ['🥒', ['מלפפון', 'cucumber', 'חמוץ', 'pickle']],
  ['🫒', ['זית', 'olive', 'זיתים']],
  ['🧅', ['בצל', 'onion']],
  ['🧄', ['שום', 'garlic']],
  ['🌶️', ['חריף', 'hot', 'צ\'ילי', 'chili', 'פפרוני', 'pepperoni', 'חלפיניו', 'jalapeno', 'שאטה']],
  ['🫑', ['פלפל', 'pepper', 'פפריקה', 'paprika']],
  ['🥕', ['גזר', 'carrot']],
  ['🌽', ['תירס', 'corn']],
  ['🥦', ['ברוקולי', 'broccoli']],
  ['🥬', ['חסה', 'lettuce', 'סלט', 'salad', 'עלים', 'leaves', 'ירוקים']],
  ['🥑', ['אבוקדו', 'avocado', 'גואקמולי', 'guacamole']],
  ['🍄', ['פטריות', 'mushroom', 'פטרי', 'שמפיניון']],
  ['🥔', ['תפוח אדמה', 'potato', 'צ\'יפס', 'chips', 'fries', 'פרנצ\'']],
  ['🍆', ['חציל', 'eggplant']],
  ['🫘', ['שעועית', 'beans', 'קטניות', 'legumes']],
  
  // Fruits
  ['🍋', ['לימון', 'lemon', 'ליים', 'lime']],
  ['🍊', ['תפוז', 'orange', 'קלמנטינה', 'clementine', 'הדרים']],
  ['🍎', ['תפוח', 'apple']],
  ['🍌', ['בננה', 'banana']],
  ['🍓', ['תות', 'strawberry']],
  ['🫐', ['אוכמניות', 'blueberry', 'פירות יער', 'berries']],
  ['🍑', ['אפרסק', 'peach']],
  ['🥭', ['מנגו', 'mango']],
  ['🍍', ['אננס', 'pineapple']],
  ['🥝', ['קיווי', 'kiwi']],
  ['🍉', ['אבטיח', 'watermelon']],
  ['🥥', ['קוקוס', 'coconut']],
  ['🍇', ['ענבים', 'grape', 'ענב']],
  ['🫙', ['ריבה', 'jam', 'ממרח', 'spread']],
  
  // Nuts & Seeds
  ['🥜', ['בוטנים', 'peanut', 'אגוזים', 'nuts', 'אגוז']],
  ['🌰', ['שקדים', 'almond', 'אגוז לוז', 'hazelnut', 'פקאן', 'pecan', 'קשיו', 'cashew']],
  
  // Sweets & Desserts
  ['🍫', ['שוקולד', 'chocolate', 'שוקו', 'קקאו', 'cocoa', 'נוטלה', 'nutella']],
  ['🍰', ['עוגה', 'cake', 'עוגת']],
  ['🧁', ['מאפין', 'muffin', 'קאפקייק', 'cupcake']],
  ['🍩', ['דונאט', 'donut', 'סופגניה']],
  ['🍪', ['עוגיה', 'cookie', 'ביסקוויט', 'biscuit']],
  ['🍬', ['סוכריה', 'candy', 'ממתק', 'sweet']],
  ['🍯', ['דבש', 'honey']],
  ['🧇', ['וופל', 'waffle']],

  // Sauces & Condiments
  ['🫙', ['רוטב', 'sauce', 'סלסה', 'salsa']],
  ['🥫', ['קטשופ', 'ketchup', 'רוטב עגבניות', 'טומטו']],
  ['🫕', ['פונדו', 'fondue', 'טבילה', 'dip']],
  ['🧂', ['מלח', 'salt', 'תיבול', 'seasoning', 'תבלין', 'spice']],
  
  // Grains & Cereals
  ['🍚', ['אורז', 'rice', 'דגנים', 'cereal', 'גרנולה', 'granola']],
  ['🫙', ['קינואה', 'quinoa', 'בורגול', 'bulgur', 'קוסקוס', 'couscous']],

  // Cooking & Serving
  ['🔥', ['גריל', 'grill', 'על האש', 'צלוי', 'grilled', 'מעושן', 'smoked']],
  ['🫕', ['מבושל', 'cooked', 'תבשיל']],
  ['🍽️', ['הגשה', 'serving', 'סוג צלחת', 'plate']],
  ['🥡', ['טייק אוויי', 'takeaway', 'take away', 'לקחת', 'אריזה']],
  ['🥢', ['סושי', 'chopsticks', 'אסיאתי', 'asian']],
  
  // Properties / Attributes
  ['💪', ['חוזק', 'strength', 'חזק', 'strong', 'עדין', 'mild']],
  ['🌡️', ['טמפרטורה', 'temp', 'חום', 'heat', 'קר', 'cold', 'חם', 'hot', 'רותח', 'פושר', 'קרח']],
  ['🫧', ['קצף', 'foam', 'מוקצף']],
  ['🧊', ['בסיס', 'base', 'קרח', 'ice']],
  ['📏', ['גודל', 'size', 'כמות', 'quantity', 'מידה', 'portion']],
  ['➕', ['תוספ', 'extra', 'topping', 'נוסף', 'addition']],
  ['✏️', ['מותאם', 'custom', 'הערה', 'note', 'הגדרה']],
  ['🚫', ['ללא', 'without', 'בלי', 'no']],
  ['♻️', ['טבעוני', 'vegan', 'צמחוני', 'vegetarian']],
  ['🌿', ['טבעי', 'natural', 'אורגני', 'organic', 'ירוק', 'green']],
];

const detectGroupIcon = (name) => {
  const n = (name || '').toLowerCase();
  for (const [emoji, keywords] of ICON_MAP) {
    if (keywords.some(k => n.includes(k))) return emoji;
  }
  return '📋';
};

const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const compressedFile = new File([blob], file.name || `photo_${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve({
              file: compressedFile,
              previewUrl: URL.createObjectURL(blob),
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const isSecureOrigin = () => {
  return window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
};

const ModifierModal = (props) => {
  const { isOpen, selectedItem, onClose, onAddItem, aiDetection, businessId, onItemUpdated, onStartBackgroundEnhancement, enhancingItems = {}, initialEditMode = false } = props;

  // ⚠️ CRITICAL: All hooks MUST be called before any early returns (React Rules of Hooks)
  const [optionGroups, setOptionGroups] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [optionSelections, setOptionSelections] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [clerkChoice, setClerkChoice] = useState(null); // 'GRAB_AND_GO' or 'MADE_TO_ORDER'
  const [showTraining, setShowTraining] = useState(false);
  const { trainProduct, trainingStatus, vectorCount, maxVectors, errorDetail, resetTraining, fetchVectorCount, resetVectors } = useProductTraining();

  // ── Edit Mode State ──
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [editData, setEditData] = useState(null);           // { name, price, image_url }
  const [editModifierPrices, setEditModifierPrices] = useState({}); // { [valueId]: newPrice }
  const [editStock, setEditStock] = useState(null);
  const [linkedInventoryItemId, setLinkedInventoryItemId] = useState(null);  // inventory_items.id linked via recipe_ingredients
  const [isSaving, setIsSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // ── Edit Mode Modifier Groups State ──
  const [editGroups, setEditGroups] = useState([]);          // Full array of modifier groups
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);   // Which group tab is active
  const [showGroupPicker, setShowGroupPicker] = useState(false); // Show template picker
  const [isAddingItemToGroup, setIsAddingItemToGroup] = useState(false); // Adding new item to current group
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [linkingItemKey, setLinkingItemKey] = useState(null); // Key of item whose inventory link dropdown is open
  const [linkSearch, setLinkSearch] = useState('');
  const [dragSource, setDragSource] = useState(null);        // { groupIdx, itemIdx } for drag-and-drop
  const [dragOverGroupIdx, setDragOverGroupIdx] = useState(null); // Visual feedback for drag target

  // ── Edit Tab Navigation ──
  const [editTab, setEditTab] = useState('modifiers'); // 'modifiers' | 'recipe' | 'training' | 'advanced'
  const [editKdsStation, setEditKdsStation] = useState({ kitchen: true, bar: false }); // checkboxes
  const [editKdsRouting, setEditKdsRouting] = useState('MADE_TO_ORDER'); // 'GRAB_AND_GO' | 'MADE_TO_ORDER' | 'CONDITIONAL'
  const [editIsInStock, setEditIsInStock] = useState(true);

  // ── Recipe Panel State ──
  const [showRecipe, setShowRecipe] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeId, setRecipeId] = useState(null);
  const [recipeSaveStatus, setRecipeSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
  const [recipeCostVariant, setRecipeCostVariant] = useState(null); // null = default, or inventory_item_id of the substitute to view

  // ── Photo Capture State ──
  const [capturedPhoto, setCapturedPhoto] = useState(null);     // Raw photo blob URL
  const [isEnhancing, setIsEnhancing] = useState(false);        // ComfyUI Bridge processing
  const [enhanceProgress, setEnhanceProgress] = useState('');   // SSE progress message
  const [enhancedPhoto, setEnhancedPhoto] = useState(null);     // Enhanced result blob URL
  const [photoFile, setPhotoFile] = useState(null);             // Raw File object for upload
  const [rawPhotoFile, setRawPhotoFile] = useState(null);       // Store original file before background removal
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);        // Toggle for automatic background removal
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const fileInputRef = useRef(null);
  const [categoriesList, setCategoriesList] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const bId = businessId || selectedItem?.business_id;
      if (!bId) return;
      try {
        const { data, error } = await supabase
          .from('item_category')
          .select('id, name, name_he')
          .eq('business_id', bId)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('position', { ascending: true });
        if (data) {
          setCategoriesList(data);
        }
      } catch (err) {
        console.warn('⚠️ [ModifierModal] Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, [businessId, selectedItem?.business_id]);

  // Sync category UUID once categoriesList is loaded
  useEffect(() => {
    if (isEditMode && editData && !editData.category && selectedItem) {
      const catText = selectedItem.category_id || selectedItem._categoryId || selectedItem.category;
      if (catText) {
        const found = categoriesList.find(c => c.id === catText || c.name === catText || c.name_he === catText);
        if (found) {
          setEditData(prev => prev ? { ...prev, category: found.id } : null);
        }
      }
    }
  }, [categoriesList, isEditMode, selectedItem, editData?.category]);

  // Fetch vector count when training panel opens (flip OR tab)
  useEffect(() => {
    if ((showTraining || (isEditMode && editTab === 'training')) && selectedItem) {
      const itemId = selectedItem?.id || selectedItem?.menu_item_id;
      const bId = businessId || selectedItem?.business_id;
      if (itemId && bId) fetchVectorCount(itemId, bId);
    }
  }, [showTraining, editTab, selectedItem?.id]);

  // Check if this is an espresso item
  const isEspresso = selectedItem?.name?.includes('אספרסו');
  const isConditional = selectedItem?.kds_routing_logic === 'CONDITIONAL';

  const [lastLoadedId, setLastLoadedId] = useState(null);

  // Reset state when selectedItem changes (only if it's a NEW item)
  useEffect(() => {
    const currentId = selectedItem?.id || selectedItem?.menu_item_id;
    if (currentId && currentId !== lastLoadedId) {
      console.log('🔄 [ModifierModal] Resetting for new item:', currentId);
      setOptionGroups([]);
      setOptionSelections({});
      setShowAdvanced(false);
      setOrderNote('');
      setIsNoteOpen(false);
      setItemQuantity(1);
      setClerkChoice(null);
      setShowTraining(false);
      resetTraining();
      setLastLoadedId(currentId);
      // Reset edit mode
      setIsEditMode(false);
      setShowPinModal(false);
      setEditData(null);
      setEditModifierPrices({});
      setEditStock(null);
      setIsSaving(false);
      setEditSuccess(false);
    }
  }, [selectedItem?.id]);

  // Auto-enter edit mode for products is now handled in the unified effect below fetchInventoryForRecipe to support existing items as well.

  useEffect(() => {
    if (!isOpen || !selectedItem) {
      return;
    }

    const currentId = selectedItem?.id || selectedItem?.menu_item_id;
    // 🛡️ DUAL-LOAD GUARD: If we already have options for this specific ID, don't re-trigger the load logic
    // this specifically fixes the 'shakiness' of jsonb items that might trigger reference changes.
    if (optionGroups.length > 0 && currentId === lastLoadedId) {
      return;
    }

    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const targetItemId = selectedItem.menu_item_id || selectedItem.id;

        console.log('🔄 Loading Options for:', selectedItem.name, 'ID:', targetItemId);
        
        let fetchedOptions = [];

        // 🛡️ REVERT TO OLD STABLE WAY: Always prioritize table-based options (DB/Cache) over JSONB to fix jank
        // 🔥 NEW ARCHITECTURE: ALWAYS prefer embedded JSONB modifiers!
        if (selectedItem?.modifiers && Array.isArray(selectedItem.modifiers) && selectedItem.modifiers.length > 0) {
          console.log('🍕 Using Embedded JSON Modifiers for:', selectedItem.name);
          fetchedOptions = selectedItem.modifiers.map(group => {
            const isAdditive = group.type === 'additive';
            const isLogicalMulti = !isAdditive && group.logic === 'A' && group.maxSelection !== 1 && group.max_selection !== 1;
            const isMultiSelect = isAdditive || group.is_multiple_select || isLogicalMulti;
            
            return {
              id: group.id || `json-group-${group.name.replace(/\s+/g, '_')}`,
              title: group.name,
              name: group.name,
              type: isMultiSelect ? 'multi' : 'single',
              is_multiple_select: isMultiSelect,
              is_required: group.requirement ? group.requirement === 'M' : (group.is_required || group.minSelection > 0),
              min_selection: group.requirement === 'O' ? 0 : (group.minSelection || 0),
              max_selection: group.maxSelection || (isMultiSelect ? 99 : 1),
              category: 'general',
              show_default: group.show_default !== undefined ? group.show_default : (group.name || '').includes('חלב'),
              modifier_type: group.type || 'replacement',
              values: (group.items || []).map((item, idx) => ({
                id: item.id || `json-val-${item.name.replace(/\s+/g, '_')}`,
                name: item.name,
                price: item.price || 0,
                priceAdjustment: item.price || 0,
                is_default: Boolean(item.isDefault || item.is_default), // Crucial for auto-selecting "רגיל"
                // 📦 Inventory linkage — passed through from JSONB
                inventory_item_id: item.inventory_item_id || null,
                inhibits_ingredient_id: item.inhibits_ingredient_id || null,
                replaces_inventory_item_id: item.inhibits_ingredient_id || null,
                quantity: item.quantity || null
              }))
            };
          });
        } else {
          // No JSONB modifiers — skip DB fetch entirely (prevents IndexedDB hang on iPad/tablet)
          console.log('📋 No embedded modifiers for:', selectedItem.name, '— opening modal with note/add only');
          fetchedOptions = [];
        }

        let allOptions = [...(fetchedOptions || []), ...(props.extraGroups || [])];

        // ── Pre-merge milk groups globally before setting state ──
        const isMilkGroupDef = (group) => {
          const title = (group.title || group.name || '').toLowerCase();
          if (['חלב', 'milk', 'תחליף'].some(k => title.includes(k))) return true;
          return group.values?.some(v => {
            const n = (v.name || v.value_name || '').toLowerCase();
            return n.includes('סויה') || n.includes('שיבולת') || n.includes('שקדים') ||
                   n.includes('חלב') || n.includes('soy') || n.includes('oat') || n.includes('almond');
          });
        };

        const milkGroups = allOptions.filter(isMilkGroupDef);
        if (milkGroups.length > 1) {
          console.log('🥛 Merging multiple milk groups into one global group. Discovered:', milkGroups.length);
          const primary = milkGroups[0];
          const secondaryIds = new Set(milkGroups.slice(1).map(g => String(g.id)));

          const seenNames = new Set();
          const mergedValues = [];
          for (const mg of milkGroups) {
            for (const v of (mg.values || [])) {
              const n = (v.name || v.value_name || '').toLowerCase().trim();
              const key = n.includes('סויה') ? 'סויה' :
                          n.includes('שיבולת') ? 'שיבולת' :
                          n.includes('שקדים') ? 'שקדים' :
                          n.includes('רגיל') ? 'רגיל' : n;
              if (!seenNames.has(key)) {
                seenNames.add(key);
                mergedValues.push(v);
              }
            }
          }

          const mergedMilkGroup = {
            ...primary,
            values: mergedValues
          };

          allOptions = allOptions.filter(g => !secondaryIds.has(String(g.id)));
          allOptions = allOptions.map(g => String(g.id) === String(primary.id) ? mergedMilkGroup : g);
        }

        setOptionGroups(allOptions);
        setIsLoadingOptions(false);

        console.log('🔍 ModifierModal AutoAdd Check:', {
          item: selectedItem.name,
          optionsCount: allOptions.length,
          allowAutoAdd: props.allowAutoAdd
        });

        /* 
        // 🛡️ REVED: Removed auto-add logic to prevent modal from closing in user's face
        // if network error occurs OR if they just want to add a note to a plain item.
        if (allOptions.length === 0 && props.allowAutoAdd !== false) {
           ...
        }
        */

        processDefaults(allOptions);

      } catch (error) {
        console.error('Error loading options:', error);
        setIsLoadingOptions(false);
        // 🛡️ Do NOT auto-add and close — let the modal stay open for notes/quantity
        setOptionGroups([]);
      }
    };

    const isMilkGroup = (group) => {
      const title = (group.title || group.name || '').toLowerCase();
      if (['חלב', 'milk', 'תחליף'].some(k => title.includes(k))) return true;
      return group.values?.some(v => {
        const n = (v.name || v.value_name || '').toLowerCase();
        return n.includes('סויה') || n.includes('שיבולת') || n.includes('שקדים') ||
               n.includes('חלב') || n.includes('soy') || n.includes('oat') || n.includes('almond');
      });
    };

    const processDefaults = (options) => {
      const defaults = {};
      const existingSelections = selectedItem.selectedOptions || [];

      options.forEach(group => {
        const groupId = String(group.id);
        const isMultipleSelect = group.is_multiple_select || group.type === 'addition' || group.type === 'multi';
        const isMandatory = group.is_required || group.required || (group.min_selection !== undefined && group.min_selection > 0);

        if (isMultipleSelect) {
          const existingToppings = existingSelections
            .filter(opt => String(opt.groupId) === groupId)
            .map(opt => String(opt.valueId));
          
          if (existingToppings.length > 0) {
            defaults[groupId] = existingToppings;
          } else {
            // New logic: Also support defaults in multi-select groups
            const defaultValues = group.values
              ?.filter(v => v.is_default || (v.name || '').includes('רגיל'))
              .map(v => String(v.id)) || [];
            defaults[groupId] = defaultValues;
          }
          return;
        }

        // --- Single Select Logic ---
        let existingChoice = existingSelections.find(opt =>
          opt.groupId && String(opt.groupId) === groupId
        );

        if (!existingChoice) {
          const matchingValue = group.values?.find(v =>
            existingSelections.some(sel => {
              if (typeof sel === 'string') return sel === v.name;
              return sel.valueName === v.name;
            })
          );
          if (matchingValue) existingChoice = { valueId: matchingValue.id };
        }

        if (existingChoice) {
          const existingVal = group.values?.find(v => String(v.id) === String(existingChoice.valueId));
          if (existingVal) {
            defaults[groupId] = String(existingVal.id);
            return;
          }
        }

        const isMilk = isMilkGroup(group);

        // No existing — set default
        if (isMandatory || isMilk) {
          const defaultVal = group.values?.find(v => v.is_default) ||
            group.values?.find(v => (v.name || '').includes('רגיל'));

          if (defaultVal) {
            defaults[groupId] = String(defaultVal.id);
          } else if (group.values?.length > 0 && isMandatory) {
            const isComplexCoffeeGroup = (group.name || '').includes('קצף') || (group.name || '').includes('טמפרטו');
            if (!isComplexCoffeeGroup) {
              defaults[groupId] = String(group.values[0].id);
            }
          }
        } else {
          const explicitlyDefault = group.values?.find(v => v.is_default);
          if (explicitlyDefault) {
            defaults[groupId] = String(explicitlyDefault.id);
          }
        }
      });


      setOptionSelections(defaults);

      const hasOtherGroupSelections = options.some((group) => {
        if (isMilkGroup(group)) return false;
        return existingSelections.some(opt =>
          String(opt.groupId) === String(group.id)
        );
      });

      const hasMilk = options.some(g => isMilkGroup(g));
      if ((hasOtherGroupSelections && options.length > 1) || !hasMilk) {
        setShowAdvanced(true);
      }
    };

    loadOptions();
  }, [isOpen, selectedItem?.id]);

  const { heroGroup, heroType, foamGroup, tempGroup, baseGroup, strengthGroup, otherGroups } = useMemo(() => {
    if (!optionGroups?.length) return {
      heroGroup: null, heroType: 'none', foamGroup: null, tempGroup: null,
      baseGroup: null, strengthGroup: null, otherGroups: []
    };

    const usedIds = new Set();
    const normalize = (str) => (str || '').toLowerCase();

    const hasValue = (group, keyword) => {
      return group.values?.some(v => {
        const valName = normalize(v.name || v.value_name);
        return valName.includes(keyword);
      });
    };

    const checkGroup = (group, keywords, category) => {
      const title = normalize(group.title || group.name);
      const cat = normalize(group.category);

      if (category && cat === category) return true;
      return keywords.some(k => title.includes(k));
    };

    // 1. Identify Milk Group (now already merged in loadOptions)
    const milkGroups = optionGroups.filter(g => checkGroup(g, ['חלב', 'milk', 'תחליף'], 'milk') || 
      g.values?.some(v => {
        const n = normalize(v.name || v.value_name);
        return n.includes('סויה') || n.includes('שיבולת') || n.includes('שקדים') ||
               n.includes('חלב') || n.includes('soy') || n.includes('oat') || n.includes('almond');
      })
    );
    
    milkGroups.forEach(g => usedIds.add(g.id));
    const milk = milkGroups.length > 0 ? milkGroups[0] : null;

    // ---------------------------------------------------------
    // 2. Identify Espresso Type Group (Start/Short/Long)
    // ---------------------------------------------------------
    const espressoTypeGroup = optionGroups.find(g => {
      if (usedIds.has(g.id)) return false;
      // Check for specific espresso keywords
      const isEspressoType = g.values?.some(v => {
        const n = normalize(v.name || v.value_name);
        return n.includes('קצר') || n.includes('ארוך') || n.includes('כפול');
      });
      return isEspressoType;
    });
    // Note: We don't mark espressoTypeGroup as 'used' here because we might want to render it 
    // in the Hero section, OR we treat it as a special "Hero" candidate.
    // Let's decide: If we found a milk group, that takes Hero precedence usually.
    // BUT for "Espresso", the Coffee Type IS the Hero.

    // Strategy: If selected item is Espresso, the EspressoTypeGroup is the "Milk" (Hero) equivalent.
    let heroGroup = null;
    let heroType = 'none'; // 'milk' or 'coffee-type'

    if (selectedItem?.name?.includes('אספרסו') && espressoTypeGroup) {
      heroGroup = espressoTypeGroup;
      heroType = 'coffee-type';
      usedIds.add(espressoTypeGroup.id);
    } else {
      heroGroup = milk;
      heroType = 'milk';
      // milk IDs already added
    }


    // 3. Foam
    const foam = optionGroups.find(g => {
      if (usedIds.has(g.id)) return false;
      return checkGroup(g, ['קצף', 'foam'], 'texture') || hasValue(g, 'קצף');
    });
    if (foam) usedIds.add(foam.id);

    // 4. Temp
    const temp = optionGroups.find(g => {
      if (usedIds.has(g.id)) return false;
      return checkGroup(g, ['טמפרטורה', 'חום', 'temp'], 'temperature') ||
        hasValue(g, 'רותח') || hasValue(g, 'פושר');
    });
    if (temp) usedIds.add(temp.id);

    // 5. Base
    let base = optionGroups.find(g => {
      if (usedIds.has(g.id)) return false;
      return checkGroup(g, ['בסיס', 'base', 'water'], 'base') ||
        hasValue(g, 'בסיס') || hasValue(g, 'מים');
    });

    // Special verification for base
    if (base) {
      const isCoffeeItem = selectedItem?.name?.includes('קפה') ||
        selectedItem?.name?.includes('הפוך') ||
        selectedItem?.name?.includes('אספרסו') ||
        selectedItem?.name?.includes('נס') ||
        selectedItem?.name?.includes('מקיאטו');

      if (isCoffeeItem) {
        const hasWaterOrMilkBase = base.values.some(v =>
          v.name.includes('מים') || v.name.includes('חלב') || v.name.includes('סודה')
        );
        if (!hasWaterOrMilkBase) {
          base = null;
        }
      }
    }
    if (base) usedIds.add(base.id);

    // 6. Strength
    const strength = optionGroups.find(g => {
      if (usedIds.has(g.id)) return false;
      return checkGroup(g, ['חוזק', 'strength'], 'strength') ||
        hasValue(g, 'חזק') || hasValue(g, 'חלש');
    });
    if (strength) usedIds.add(strength.id);

    // 7. Others - Strictly everything else
    const others = optionGroups.filter(g => !usedIds.has(g.id));

    return {
      heroGroup, heroType, foamGroup: foam, tempGroup: temp,
      baseGroup: base, strengthGroup: strength, otherGroups: others
    };
  }, [optionGroups, selectedItem]);

  const unitPrice = useMemo(() => {
    if (!selectedItem) return 0;
    let sum = Number(selectedItem?.price || 0);

    (optionGroups || []).forEach(group => {
      const selectedId = optionSelections[group.id];
      if (!selectedId) return;

      const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
      if (isMultipleSelect && Array.isArray(selectedId)) {
        selectedId.forEach(id => {
          const value = group.values?.find(v => String(v.id) === String(id));
          const effectivePrice = Number(value?.priceAdjustment || 0);
          if (effectivePrice > 0) sum += effectivePrice;
        });
      } else {
        const value = group.values?.find(v => String(v.id) === selectedId);
        const effectivePrice = Number(value?.priceAdjustment || 0);
        if (effectivePrice > 0) sum += effectivePrice;
      }
    });
    return sum;
  }, [selectedItem?.price, optionGroups, optionSelections]);

  const totalPrice = useMemo(() => {
    return unitPrice * itemQuantity;
  }, [unitPrice, itemQuantity]);

  const toggleOption = (groupId, valueId) => {
    if (!selectedItem) return;

    setOptionSelections(prev => {
      const group = (optionGroups || []).find(g => g.id === groupId);
      const current = prev[groupId];

      // 🥛 MILK RULE: Milk is ALWAYS single select, even if DB says otherwise
      const title = (group?.title || group?.name || '').toLowerCase();
      const isMilkGroup = ['חלב', 'milk', 'תחליף'].some(k => title.includes(k)) || 
                          group?.values?.some(v => (v.name || '').toLowerCase().includes('סויה') || (v.name || '').toLowerCase().includes('שיבולת'));

      // Strict Logic: 'replacement' type is ALWAYS single select
      const isReplacement = group?.type === 'replacement';
      const isMultipleSelect = !isMilkGroup && !isReplacement && (group?.is_multiple_select || group?.type === 'addition' || group?.type === 'multi');

      const isOptional = group?.min_selection === 0 && !group?.is_required;

      // MULTI SELECT
      if (isMultipleSelect) {
        const currentArray = Array.isArray(current) ? current : [];
        const valueIdStr = String(valueId);
        if (currentArray.includes(valueIdStr)) {
          return { ...prev, [groupId]: currentArray.filter(id => id !== valueIdStr) };
        }
        return { ...prev, [groupId]: [...currentArray, valueIdStr] };
      }

      // SINGLE SELECT
      const valueIdStr = String(valueId);

      // If clicking the ALREADY selected item...
      if (String(current) === valueIdStr) {
        // If there's a default option in this group that is NOT the currently selected one,
        // toggle back to the default option.
        const defaultVal = group?.values?.find(v => v.is_default || (v.name || '').includes('רגיל'));
        if (defaultVal && String(defaultVal.id) !== valueIdStr) {
          return { ...prev, [groupId]: String(defaultVal.id) };
        }

        // If optional, allow toggle OFF (deselect)
        if (isOptional) {
          return { ...prev, [groupId]: null };
        }
        // If mandatory, do nothing (keep selected)
        return prev;
      }

      // Select new item
      return { ...prev, [groupId]: valueIdStr };
    });
  };

  const handleAdd = () => {
    const selectedOptions = (optionGroups || []).flatMap(group => {
      const selId = optionSelections[group.id];
      if (!selId) return [];

      const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
      if (isMultipleSelect && Array.isArray(selId)) {
        return selId.map(id => {
          const val = group.values.find(v => String(v.id) === String(id));
          if (!val) return null;
          const effectivePrice = Number(val.priceAdjustment || 0);
          return {
            groupId: group.id,
            groupName: group.title || group.name, // Use title
            valueId: val.id,
            valueName: val.name,
            priceAdjustment: effectivePrice,
            // 📦 Inventory linkage for recipe-based deduction
            inventory_item_id: val.inventory_item_id || null,
            replaces_inventory_item_id: val.inhibits_ingredient_id || val.replaces_inventory_item_id || null,
            inhibits_ingredient_id: val.inhibits_ingredient_id || null,
            quantity: val.quantity || null,
            multiplier: val.multiplier || null
          };
        }).filter(Boolean);
      }

      const val = group.values.find(v => String(v.id) === selId);
      if (!val) return [];
      const effectivePrice = Number(val.priceAdjustment || 0);
      if (val.name?.includes('רגיל') && effectivePrice === 0) return [];

      return [{
        groupId: group.id,
        groupName: group.title || group.name, // Use title
        valueId: val.id,
        valueName: val.name,
        priceAdjustment: effectivePrice,
        // 📦 Inventory linkage for recipe-based deduction
        inventory_item_id: val.inventory_item_id || null,
        replaces_inventory_item_id: val.inhibits_ingredient_id || val.replaces_inventory_item_id || null,
        inhibits_ingredient_id: val.inhibits_ingredient_id || null,
        quantity: val.quantity || null,
        multiplier: val.multiplier || null
      }];
    });

    if (isConditional && !clerkChoice) {
      // Shaky effect or notification could go here
      alert('יש לבחור סוג הכנה (לקוח קיבל/נדרשת הכנה) כדי להמשיך');
      return;
    }

    onAddItem?.({
      ...selectedItem,
      tempId: `${selectedItem.id}-${Date.now()}`,
      quantity: itemQuantity,
      selectedOptions,
      notes: orderNote, // Add the note here
      totalPrice,
      price: unitPrice,
      // **תיקון קריטי: עדכון ה-Logic לפי בחירת הקופאי**
      kds_routing_logic: isConditional ? clerkChoice : selectedItem.kds_routing_logic,
      // AI Detection: flag for active learning
      ...(aiDetection ? { _aiConfirmation: true, _capturedBlob: aiDetection.capturedBlob } : {})
    });
    onClose();
  };

  // ── Edit Mode Handlers ──
  const handlePinSuccess = useCallback((manager) => {
    console.log('✅ [EditMode] PIN verified by:', manager.name);
    const itemId = selectedItem?.id || selectedItem?.menu_item_id;
    setIsEditMode(true);
    setEditData({
      name: selectedItem?.name || '',
      price: selectedItem?.price || selectedItem?.sale_price || 0,
      image_url: selectedItem?.image || selectedItem?.image_url || '',
      category: selectedItem?.category_id || selectedItem?._categoryId || selectedItem?.category || ''
    });
    // Reset photo state
    setCapturedPhoto(null);
    setEnhancedPhoto(null);
    setPhotoFile(null);
    setIsEnhancing(false);
    // Initialize edit groups from JSONB
    const groups = (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []).map(group => {
      const parsedItems = (group.items || []).map(item => ({
        ...item,
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      }));
      
      // Smart type detection: if name contains תוספות/תוספת, force additive
      const groupName = (group.name || '').toLowerCase();
      const detectedType = group.type || (groupName.includes('תוספ') ? 'additive' : 'replacement');
      
      // Auto-fix: ensure every REPLACEMENT group has a default "רגיל" item
      // Additive groups don't need a default — they're extras, not replacements
      if (detectedType !== 'additive') {
        const hasDefault = parsedItems.some(item => item.isDefault || item.is_default);
        if (!hasDefault) {
          parsedItems.unshift({
            id: `item-default-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            name: 'רגיל',
            price: 0,
            isDefault: true,
            inventory_item_id: null,
          });
        }
      }
      
      return {
        ...group,
        id: group.id || `group-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        type: detectedType,
        show_default: group.show_default !== undefined ? group.show_default : (group.name || '').includes('חלב'),
        icon: group.icon || detectGroupIcon(group.name || ''),
        items: parsedItems,
      };
    });
    setEditGroups(groups);
    setActiveGroupIdx(0);
    setShowGroupPicker(false);
    setIsAddingItemToGroup(false);
    setLinkingItemKey(null);
    setLinkSearch('');
    setEditTab('modifiers');
    const kdsVal1 = (selectedItem?.kds_station || '').toLowerCase();
    const prodAreaVal1 = (selectedItem?.production_area || '').toLowerCase();
    setEditKdsStation({
      kitchen: kdsVal1.includes('kitchen') || kdsVal1.includes('both') || prodAreaVal1.includes('kitchen') || prodAreaVal1.includes('מטבח'),
      bar: kdsVal1.includes('bar') || kdsVal1.includes('both') || prodAreaVal1.includes('bar') || prodAreaVal1.includes('בר'),
    });
    setEditKdsRouting(selectedItem?.kds_routing_logic || 'MADE_TO_ORDER');
    setEditIsInStock(selectedItem?.is_in_stock !== false);
    // Initialize stock from linked inventory_items via recipe_ingredients
    setEditStock(null);
    setLinkedInventoryItemId(null);
    (async () => {
      try {
        const menuId = selectedItem?.id || selectedItem?.menu_item_id;
        if (!menuId) return;
        // Pre-load inventory options for modifier autocomplete
        fetchInventoryForRecipe();
        // 1. Find linked inventory items via recipe_ingredients
        const { data: links } = await supabase
          .from('recipe_ingredients')
          .select('inventory_item_id')
          .eq('recipe_id', menuId);

        // Only display/edit stock if there is exactly 1 inventory item in the recipe
        if (links && links.length === 1) {
          const invId = links[0].inventory_item_id;
          // 2. Fetch current stock from inventory_items
          const { data: invItem } = await supabase
            .from('inventory_items')
            .select('id, current_stock')
            .eq('id', invId)
            .single();
          if (invItem) {
            setLinkedInventoryItemId(invItem.id);
            setEditStock(invItem.current_stock ?? 0);
          }
        } else {
          setLinkedInventoryItemId(null);
          setEditStock(null);
        }
      } catch (e) {
        console.warn('⚠️ Could not load linked inventory stock:', e);
      }
    })();
  }, [selectedItem]);

  // ── Photo Capture & MLX Studio Enhancement ──
  const enhanceWithMLXStudio = useCallback(async (file) => {
    setIsEnhancing(true);
    setEnhanceProgress('מסיר רקע...');
    try {
      // Simple multipart upload to local rembg studio
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/studio/remove-bg', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Studio returned ${response.status}`);
      }

      const enhancedBlob = await response.blob();
      const enhancedUrl = URL.createObjectURL(enhancedBlob);
      const processingTime = response.headers.get('X-Processing-Time') || '?';

      setEnhancedPhoto(enhancedUrl);
      setPhotoFile(new File([enhancedBlob], `studio_${Date.now()}.png`, { type: 'image/png' }));
      setEnhanceProgress(`✨ רקע הוסר! (${processingTime})`);
      console.log(`✨ [Local Studio] Enhanced in ${processingTime}`);
    } catch (err) {
      console.warn('⚠️ [Local Studio] Error:', err.message);
      setEnhanceProgress('לא זמין — משתמש בתמונה מקורית');
    } finally {
      setIsEnhancing(false);
      setTimeout(() => setEnhanceProgress(''), 3000);
    }
  }, []);

  const handlePhotoCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setEnhanceProgress('מעבד תמונה...');
      setIsEnhancing(true);
      
      // Compress to max 800x800, jpeg quality 0.8 to prevent memory crashes and speed up background removal
      const compressed = await compressImage(file, 800, 800, 0.8);
      
      setCapturedPhoto(compressed.previewUrl);
      setRawPhotoFile(compressed.file);
      setPhotoFile(compressed.file);
      setEnhancedPhoto(null);
      
      if (autoRemoveBg) {
        setEnhanceProgress('מסיר רקע...');
        enhanceWithMLXStudio(compressed.file).catch(() => {});
      } else {
        setIsEnhancing(false);
        setEnhanceProgress('');
      }
    } catch (err) {
      console.error('⚠️ [PhotoCapture] Compression error:', err);
      setIsEnhancing(false);
      setEnhanceProgress('שגיאה בעיבוד תמונה');
      setTimeout(() => setEnhanceProgress(''), 3000);
    }
  }, [autoRemoveBg, enhanceWithMLXStudio]);

  const handleToggleRemoveBg = useCallback((checked) => {
    setAutoRemoveBg(checked);
    if (!rawPhotoFile) return;
    
    if (checked) {
      enhanceWithMLXStudio(rawPhotoFile).catch(() => {});
    } else {
      // Revert to raw photo
      setEnhancedPhoto(null);
      setPhotoFile(rawPhotoFile);
      setEnhanceProgress('');
      setIsEnhancing(false);
    }
  }, [rawPhotoFile, enhanceWithMLXStudio]);

  // ── Recipe Data Functions ──
  const fetchInventoryForRecipe = useCallback(async () => {
    try {
      const bId = businessId || selectedItem?.business_id;
      console.log('🔍 fetchInventoryForRecipe — businessId:', bId);
      if (!bId) { console.warn('⚠️ No businessId for inventory fetch'); return []; }
      const { data, error } = await supabase.from('inventory_items')
        .select('id, name, base_unit, display_unit, cost_per_unit, quantity_step, recipe_step')
        .eq('business_id', bId)
        .order('name');
      if (error) throw error;
      console.log('✅ inventory_items fetched:', data?.length, 'items');
      const mapped = (data || []).map(item => ({
        ...item,
        price: item.cost_per_unit ? Number(item.cost_per_unit) : 0
      }));
      setInventoryOptions(mapped);
      return mapped; // Return data directly to avoid stale closure
    } catch (e) {
      console.warn('⚠️ Could not fetch inventory for recipe:', e);
      return [];
    }
  }, [businessId, selectedItem?.business_id]);

  // Auto-enter edit mode for products (new or existing) if initialEditMode is true
  useEffect(() => {
    if (isOpen && initialEditMode && selectedItem) {
      const isNew = selectedItem?._isNewProduct;
      console.log(`🆕 [ModifierModal] Auto-entering edit mode (isNew: ${isNew})`);
      setIsEditMode(true);
      setEditData({
        name: selectedItem?.name || '',
        price: selectedItem?.price || selectedItem?.sale_price || 0,
        image_url: selectedItem?.image || selectedItem?.image_url || '',
        category: selectedItem?.category_id || selectedItem?._categoryId || selectedItem?.category || ''
      });
      setCapturedPhoto(null);
      setEnhancedPhoto(null);
      setPhotoFile(null);
      setRawPhotoFile(null);
      setIsEnhancing(false);
      
      if (isNew) {
        setEditModifierPrices({});
        setEditGroups([]);
        setActiveGroupIdx(0);
      } else {
        // Initialize existing modifiers, stock, and KDS settings
        const groups = (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []).map(group => {
          const parsedItems = (group.items || []).map(item => ({
            ...item,
            id: item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          }));
          
          const groupName = (group.name || '').toLowerCase();
          const detectedType = group.type || (groupName.includes('תוספ') ? 'additive' : 'replacement');
          
          if (detectedType !== 'additive') {
            const hasDefault = parsedItems.some(item => item.isDefault || item.is_default);
            if (!hasDefault) {
              parsedItems.unshift({
                id: `item-default-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                name: 'רגיל',
                price: 0,
                isDefault: true,
                inventory_item_id: null,
              });
            }
          }
          
          return {
            ...group,
            id: group.id || `group-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            type: detectedType,
            show_default: group.show_default !== undefined ? group.show_default : (group.name || '').includes('חלב'),
            icon: group.icon || detectGroupIcon(group.name || ''),
            items: parsedItems,
          };
        });
        setEditGroups(groups);
        setActiveGroupIdx(0);
        setShowGroupPicker(false);
        setIsAddingItemToGroup(false);
        setLinkingItemKey(null);
        setLinkSearch('');
        setEditTab('modifiers');
        const kdsVal2 = (selectedItem?.kds_station || '').toLowerCase();
        const prodAreaVal2 = (selectedItem?.production_area || '').toLowerCase();
        setEditKdsStation({
          kitchen: kdsVal2.includes('kitchen') || kdsVal2.includes('both') || prodAreaVal2.includes('kitchen') || prodAreaVal2.includes('מטבח'),
          bar: kdsVal2.includes('bar') || kdsVal2.includes('both') || prodAreaVal2.includes('bar') || prodAreaVal2.includes('בר'),
        });
        setEditKdsRouting(selectedItem?.kds_routing_logic || 'MADE_TO_ORDER');
        setEditIsInStock(selectedItem?.is_in_stock !== false);
        setEditStock(null);
        setLinkedInventoryItemId(null);
        
        // Fetch inventory link
        (async () => {
          try {
            const menuId = selectedItem?.id || selectedItem?.menu_item_id;
            if (!menuId) return;
            fetchInventoryForRecipe();
            const { data: links } = await supabase
              .from('recipe_ingredients')
              .select('inventory_item_id')
              .eq('recipe_id', menuId);

            if (links && links.length === 1) {
              const invId = links[0].inventory_item_id;
              const { data: invItem } = await supabase
                .from('inventory_items')
                .select('id, current_stock')
                .eq('id', invId)
                .single();
              if (invItem) {
                setLinkedInventoryItemId(invItem.id);
                setEditStock(invItem.current_stock ?? 0);
              }
            }
          } catch (e) {
            console.error('Error fetching inventory stock in initialEditMode:', e);
          }
        })();
      }
    }
  }, [isOpen, selectedItem?.id, initialEditMode]);

  const fetchRecipeData = useCallback(async (inventoryOverride) => {
    const menuId = selectedItem?.id || selectedItem?.menu_item_id;
    if (!menuId) return;
    setRecipeLoading(true);
    try {
      // 1. Find recipe
      const { data: recipeRows } = await supabase
        .from('recipes').select('id').eq('menu_item_id', menuId);
      const recipeIds = (recipeRows || []).map(r => r.id).filter(Boolean);
      
      if (!recipeIds.length) {
        setRecipeId(null);
        setRecipeIngredients([]);
        setRecipeLoading(false);
        return;
      }
      
      const activeRecipeId = Math.max(...recipeIds);
      setRecipeId(activeRecipeId);
      
      // 2. Fetch ingredients
      const { data: ingredients } = await supabase.from('recipe_ingredients')
        .select('id, recipe_id, inventory_item_id, quantity_used, unit_of_measure')
        .eq('recipe_id', activeRecipeId);
      
      // 3. Build from inventory map — use override (direct from fetch) or fallback to state
      const invSource = inventoryOverride || inventoryOptions;
      console.log('📦 fetchRecipeData — using inventory source with', invSource.length, 'items');
      const invMap = invSource.reduce((acc, it) => {
        acc[String(it.id)] = it;
        return acc;
      }, {});
      
      setRecipeIngredients((ingredients || []).map(row => {
        const inv = invMap[String(row.inventory_item_id)] || {};
        const qty = row.quantity_used ? Number(row.quantity_used) : 0;
        const price = inv.price || 0;
        return {
          id: row.id,
          inventory_item_id: row.inventory_item_id,
          name: inv.name || 'רכיב לא ידוע',
          quantity: qty,
          unit: row.unit_of_measure || inv.display_unit || inv.base_unit || 'kg',
          price,
          subtotal: qty * price
        };
      }));
    } catch (e) {
      console.error('❌ fetchRecipeData error:', e);
    } finally {
      setRecipeLoading(false);
    }
  }, [selectedItem?.id, selectedItem?.menu_item_id, inventoryOptions]);

  const createNewRecipe = useCallback(async () => {
    const menuId = selectedItem?.id || selectedItem?.menu_item_id;
    const bId = businessId || selectedItem?.business_id;
    if (!menuId || !bId) {
      console.error('❌ createNewRecipe: missing menuId or businessId', { menuId, bId });
      return null;
    }
    
    setRecipeSaveStatus('saving');
    try {
      console.log('📝 Creating new recipe for menu item:', menuId);
      const { error: insertError } = await supabase.from('recipes')
        .insert({ menu_item_id: menuId, business_id: bId, preparation_quantity: 1 });
      if (insertError) throw insertError;
      
      // Fetch the created recipe ID
      const { data: recipes, error: fetchError } = await supabase.from('recipes')
        .select('id')
        .eq('menu_item_id', menuId)
        .order('id', { ascending: false })
        .limit(1);
      if (fetchError) throw fetchError;
      
      const newId = recipes?.[0]?.id;
      if (!newId) throw new Error('Recipe created but ID not found');
      
      console.log('✅ Recipe created with id:', newId);
      setRecipeId(newId);
      setRecipeIngredients([]);
      setRecipeSaveStatus('saved');
      setTimeout(() => setRecipeSaveStatus('idle'), 1500);
      return newId;
    } catch (e) {
      console.error('❌ createNewRecipe error:', e);
      setRecipeSaveStatus('error');
      setTimeout(() => setRecipeSaveStatus('idle'), 2000);
      return null;
    }
  }, [selectedItem, businessId]);

  const addRecipeIngredient = useCallback(async (inventoryItem, quantity) => {
    let activeRecipeId = recipeId;
    if (!activeRecipeId) {
      activeRecipeId = await createNewRecipe();
      if (!activeRecipeId) {
        console.error('❌ addRecipeIngredient: could not create recipe');
        return;
      }
    }
    
    setRecipeSaveStatus('saving');
    try {
      const unit = inventoryItem.display_unit || inventoryItem.base_unit || 'kg';
      const step = Number(inventoryItem.recipe_step) || Number(inventoryItem.quantity_step) || 1;
      const qty = quantity != null ? Number(quantity) : step;
      
      console.log('📝 Adding recipe ingredient:', inventoryItem.name, 'qty:', qty, 'recipeId:', activeRecipeId);
      
      const { error } = await supabase.from('recipe_ingredients')
        .insert({
          recipe_id: activeRecipeId,
          inventory_item_id: inventoryItem.id,
          quantity_used: qty,
          unit_of_measure: unit,
        });
      if (error) throw error;
      
      console.log('✅ Recipe ingredient added:', inventoryItem.name);
      
      // Clear search immediately for responsiveness
      setIngredientSearch('');
      setShowIngredientDropdown(false);
      setRecipeSaveStatus('saved');
      setTimeout(() => setRecipeSaveStatus('idle'), 1500);
      
      // Re-fetch full recipe data from DB to ensure UI is in sync
      await fetchRecipeData();
    } catch (e) {
      console.error('❌ addRecipeIngredient error:', e);
      setRecipeSaveStatus('error');
      setTimeout(() => setRecipeSaveStatus('idle'), 2000);
    }
  }, [recipeId, createNewRecipe, fetchRecipeData]);

  const removeRecipeIngredient = useCallback(async (ingredientId) => {
    setRecipeSaveStatus('saving');
    try {
      const { error } = await supabase.from('recipe_ingredients')
        .delete().eq('id', ingredientId);
      if (error) throw error;
      setRecipeIngredients(prev => prev.filter(i => i.id !== ingredientId));
      setRecipeSaveStatus('saved');
      setTimeout(() => setRecipeSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('❌ removeRecipeIngredient error:', e);
      setRecipeSaveStatus('error');
      setTimeout(() => setRecipeSaveStatus('idle'), 2000);
    }
  }, []);

  const updateIngredientQuantity = useCallback(async (ingredientId, newQty) => {
    if (newQty <= 0) return;
    setRecipeSaveStatus('saving');
    try {
      const { error } = await supabase.from('recipe_ingredients')
        .update({ quantity_used: newQty })
        .eq('id', ingredientId);
      if (error) throw error;
      setRecipeIngredients(prev => prev.map(i => 
        i.id === ingredientId 
          ? { ...i, quantity: newQty, subtotal: newQty * i.price }
          : i
      ));
      setRecipeSaveStatus('saved');
      setTimeout(() => setRecipeSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('❌ updateIngredientQuantity error:', e);
      setRecipeSaveStatus('error');
      setTimeout(() => setRecipeSaveStatus('idle'), 2000);
    }
  }, []);

  // Load recipe data when recipe panel opens (flip OR tab)
  const isRecipeVisible = showRecipe || (isEditMode && editTab === 'recipe');
  useEffect(() => {
    if (isRecipeVisible && selectedItem) {
      // Pass fetched inventory directly to avoid stale closure race condition
      fetchInventoryForRecipe().then((freshInventory) => {
        if (freshInventory && freshInventory.length > 0) {
          fetchRecipeData(freshInventory);
        }
      });
    }
  }, [isRecipeVisible, selectedItem?.id]);
  
  // Re-fetch recipe data when inventoryOptions state updates (handles delayed state batching)
  useEffect(() => {
    if (isRecipeVisible && inventoryOptions.length > 0) {
      // Re-fetch if we have no ingredients yet, or if existing ingredients have placeholder names
      const hasPlaceholders = recipeIngredients.some(i => i.name === 'רכיב לא ידוע');
      if (recipeIngredients.length === 0 || hasPlaceholders) {
        fetchRecipeData();
      }
    }
  }, [inventoryOptions, isRecipeVisible]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditData(null);
    setEditModifierPrices({});
    setEditStock(null);
    setIsSaving(false);
    setEditSuccess(false);
    setEditGroups([]);
    setActiveGroupIdx(0);
    setShowGroupPicker(false);
    setIsAddingItemToGroup(false);
    setNewItemName('');
    setNewItemPrice(0);
    setLinkingItemKey(null);
    setLinkSearch('');
    setShowRecipe(false);
    setRecipeIngredients([]);
    setRecipeId(null);
    setIngredientSearch('');
  }, []);

  const handleSaveEdits = useCallback(async () => {
    if (!editData || !selectedItem) return;
    const itemId = selectedItem.id || selectedItem.menu_item_id;
    setIsSaving(true);

    try {
      // 1. Build updated modifiers directly from editGroups
      const updatedModifiers = editGroups.map(group => {
        // Find default item in this group to identify what inventory item it replaces
        const defaultItem = (group.items || []).find(item => item.isDefault || item.is_default);
        const defaultInvId = defaultItem?.inventory_item_id || null;

        return {
          id: group.id || `group-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          name: group.name,
          icon: group.icon || '',
          type: group.type || 'replacement',
          items: (group.items || []).map(item => {
            const isDefault = !!(item.isDefault || item.is_default);
            // If it's a replacement group, and this item is NOT default, and we have a default inventory item,
            // set replaces_inventory_item_id to the default item's inventory ID.
            const replacesId = (!isDefault && group.type !== 'additive' && defaultInvId) 
              ? defaultInvId 
              : (item.replaces_inventory_item_id || null);

            return {
              id: item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
              name: item.name,
              price: Number(item.price) || 0,
              isDefault: isDefault,
              multiplier: Number(item.multiplier) || (isDefault ? 1.0 : 1.5),
              inventory_item_id: item.inventory_item_id || null,
              replaces_inventory_item_id: replacesId,
              inhibits_ingredient_id: item.inhibits_ingredient_id || replacesId || null,
            };
          }),
          logic: group.logic || 'A',
          show_default: group.show_default !== false,
          requirement: group.type === 'additive' ? 'O' : (group.requirement || 'M'),
          maxSelection: group.type === 'additive' ? (group.items || []).length : 1,
          minSelection: group.type === 'additive' ? 0 : (group.requirement === 'O' ? 0 : (group.minSelection || 1)),
        };
      });

      // 2. Build update object
      const selectedCategoryObj = categoriesList.find(c => c.id === editData.category);
      const menuUpdate = {
        name: editData.name,
        price: Number(editData.price),
        modifiers: updatedModifiers,
        category_id: editData.category || null,
        category: selectedCategoryObj ? (selectedCategoryObj.name_he || selectedCategoryObj.name) : null,
        kds_station: editKdsStation.kitchen && editKdsStation.bar ? 'both' : editKdsStation.kitchen ? 'kitchen' : editKdsStation.bar ? 'bar' : 'none',
        kds_routing_logic: editKdsRouting,
        is_in_stock: editIsInStock,
        display_kds: ['Checker', ...(editKdsStation.kitchen ? ['Kitchen'] : []), ...(editKdsStation.bar ? ['Bar'] : [])],
        production_area: ['Checker', ...(editKdsStation.kitchen ? ['Kitchen'] : []), ...(editKdsStation.bar ? ['Bar'] : [])].join(','),
      };
      // Handle photo upload — save whatever we have NOW (original or enhanced)
      if (capturedPhoto && photoFile) {
        try {
          // Convert to base64 data URL (matches existing DB format: data:image/...;base64,...)
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
          });
          menuUpdate.image_url = dataUrl;
          editData.image_url = dataUrl;
          console.log(`📸 [EditMode] Photo encoded as data URL (${(dataUrl.length / 1024).toFixed(0)} KB)`);
        } catch (uploadErr) {
          console.warn('⚠️ Photo encode error:', uploadErr);
        }
      } else if (editData.image_url !== (selectedItem.image || selectedItem.image_url || '')) {
        menuUpdate.image_url = editData.image_url;
      }

      // Handle INSERT for new products vs UPDATE for existing
      let finalItemId = itemId;
      if (selectedItem?._isNewProduct) {
        // INSERT new product
        const insertPayload = {
          ...menuUpdate,
          business_id: businessId || selectedItem?.business_id,
          category_id: editData.category || selectedItem?._categoryId || null,
          category: selectedCategoryObj ? (selectedCategoryObj.name_he || selectedCategoryObj.name) : (selectedItem?.db_category || selectedItem?.category || null),
          is_deleted: false,
        };
        const { data: insertedItem, error: insertError } = await supabase
          .from('menu_items')
          .insert(insertPayload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        finalItemId = insertedItem.id;
        console.log('✅ [EditMode] New product created with ID:', finalItemId);
      } else {
        // UPDATE existing product
        const { error: menuError } = await supabase
          .from('menu_items')
          .update(menuUpdate)
          .eq('id', itemId);
        if (menuError) throw menuError;
      }

      // 3. Update stock if changed — write to inventory_items via linked ID
      if (editStock !== null && linkedInventoryItemId) {
        try {
          const { error: stockError } = await supabase.rpc('update_inventory_stock', {
            p_item_id: linkedInventoryItemId,
            p_new_stock: editStock,
            p_counted_by: null,
            p_source: 'menu_edit'
          });
          if (stockError) {
            // Fallback: direct update
            const { error: directError } = await supabase
              .from('inventory_items')
              .update({ current_stock: editStock, last_updated: new Date().toISOString() })
              .eq('id', linkedInventoryItemId);
            if (directError) console.warn('⚠️ Stock update failed:', directError);
          }
        } catch (e) {
          console.warn('⚠️ Stock RPC failed, trying direct:', e);
          await supabase
            .from('inventory_items')
            .update({ current_stock: editStock, last_updated: new Date().toISOString() })
            .eq('id', linkedInventoryItemId);
        }
      }

      // 4. Optimistic update via parent callback
      if (selectedItem?._isNewProduct && props.onNewProductCreated) {
        props.onNewProductCreated(finalItemId);
      } else if (onItemUpdated) {
        onItemUpdated(finalItemId, {
          name: editData.name,
          price: Number(editData.price),
          image_url: editData.image_url || selectedItem.image_url,
          modifiers: updatedModifiers,
          current_stock: editStock !== null ? editStock : selectedItem.current_stock,
          is_in_stock: editIsInStock,
          kds_station: menuUpdate.kds_station,
          production_area: menuUpdate.production_area,
          display_kds: menuUpdate.display_kds,
          kds_routing_logic: editKdsRouting,
          category: menuUpdate.category,
          category_id: menuUpdate.category_id,
        });
      }

      // 5. Clear options cache for this item AND force reload on next open
      if (props.onCacheUpdate) {
        props.onCacheUpdate(prev => {
          const next = { ...prev };
          delete next[finalItemId];
          return next;
        });
      }

      // 6. Success feedback
      setEditSuccess(true);
      console.log('✅ [EditMode] Saved successfully for item:', finalItemId);
      
      // 7. If photo was captured but enhancement didn't finish, start background enhancement via parent
      if (capturedPhoto && !enhancedPhoto && onStartBackgroundEnhancement) {
        try {
          const resp = await fetch(capturedPhoto);
          const blob = await resp.blob();
          const originalFile = new File([blob], `original_${Date.now()}.png`, { type: 'image/png' });
          console.log('🎨 [EditMode] Starting background enhancement for:', finalItemId);
          onStartBackgroundEnhancement(finalItemId, originalFile, businessId);
        } catch (e) {
          console.warn('Could not start background enhancement:', e);
        }
      }
      
      setTimeout(() => {
        // Reset load guard + caches so next open fetches fresh data from DB
        setLastLoadedId(null);
        setOptionGroups([]);
        clearOptionsCache(finalItemId);
        exitEditMode();
        onClose();
      }, 1200);

    } catch (err) {
      console.error('❌ [EditMode] Save failed:', err);
      alert('שגיאה בשמירת השינויים: ' + (err.message || 'שגיאה לא ידועה'));
    } finally {
      setIsSaving(false);
    }
  }, [editData, editGroups, editStock, linkedInventoryItemId, editKdsStation, editKdsRouting, editIsInStock, selectedItem, onItemUpdated, props.onCacheUpdate, exitEditMode, photoFile, capturedPhoto, businessId, onClose]);

  if (!isOpen || !selectedItem) return null;


  try {
    console.log('🚀 ModifierModal Reaching Return Statement - Rendering JSX');
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/60 sm:backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        dir="rtl"
        onClick={onClose}
      >
        {/* Backdrop */}
        {/* The backdrop is now part of the main container div */}

        <div
          style={{ perspective: '1200px' }}
          className="relative w-full h-full sm:w-auto sm:max-w-[90vw] sm:min-w-[420px] md:max-w-xl sm:max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="relative flex flex-col w-full h-full sm:max-h-[90vh]"
          >
          {/* ═══ FRONT FACE — Normal Modal ═══ */}
          <div
            style={{
              display: (showTraining || showRecipe) ? 'none' : 'flex',
            }}
            className="flex-col w-full h-full sm:max-h-[90vh] bg-[#FAFAFA] rounded-none sm:rounded-[2rem] sm:shadow-2xl overflow-hidden flex-1"
          >
          {/* Header */}
          <div className={`bg-white/80 backdrop-blur-xl px-4 py-4 flex items-center sticky top-0 z-20 border-b ${isEditMode ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-100/50'}`}>
            {isEditMode && editData ? (
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                {/* Row 1: Image & Name + Auto-Remove Background option */}
                <div className="flex items-center gap-3 w-full">
                  {/* Item Image / Photo Capture (capture="environment" removed to prevent mobile crashes) */}
                  {(() => {
                    const currentImageUrl = enhancedPhoto || capturedPhoto || editData?.image_url || selectedItem?.image || selectedItem?.image_url;
                    return (
                      <div className="relative flex-shrink-0 group">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoCapture}
                          className="hidden"
                        />

                        <button
                          onClick={() => setShowImageUploadDialog(true)}
                          className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition-all relative bg-indigo-50 flex-shrink-0"
                        >
                          {currentImageUrl ? (
                            <img src={currentImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImagePlus size={22} className="text-indigo-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                          {isEnhancing && (
                            <div className="absolute inset-0 bg-indigo-900/60 flex items-center justify-center">
                              <Sparkles size={18} className="text-yellow-300 animate-pulse" />
                            </div>
                          )}
                          {enhancedPhoto && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                              <Sparkles size={10} className="text-white" />
                            </div>
                          )}
                        </button>
                        {capturedPhoto && !isEnhancing && (
                          <button
                            onClick={(e) => { e.stopPropagation(); photoFile && enhanceWithMLXStudio(photoFile); }}
                            className="absolute -bottom-1 -left-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors"
                            title="שפר שוב"
                          >
                            <RotateCcw size={10} className="text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Name Input */}
                  <div className="flex-[3] min-w-0">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="שם המנה"
                      className="text-base font-bold text-slate-800 tracking-tight w-full bg-white border-2 border-indigo-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      dir="rtl"
                    />
                  </div>

                  {/* Category Select (Max 25% of row) */}
                  <div className="flex-1 max-w-[25%] min-w-[90px]">
                    <select
                      value={editData.category || ''}
                      onChange={e => setEditData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full text-xs font-bold text-slate-700 bg-white border-2 border-indigo-200 rounded-xl px-2 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none text-ellipsis overflow-hidden whitespace-nowrap"
                      dir="rtl"
                    >
                      <option value="">קטגוריה...</option>
                      {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name_he || cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Price & Stock/Availability */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100/50 w-full">
                  {/* Price selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400">מחיר:</span>
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-indigo-100 shadow-inner">
                      <button
                        onClick={() => setEditData(prev => ({ ...prev, price: Math.max(0, Number(prev.price) - 1) }))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-90 transition-all shadow-sm"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>

                      <div className="w-14 text-center text-sm font-black text-slate-800 tabular-nums flex items-center justify-center gap-0.5">
                        <span className="text-xs text-slate-400">₪</span>
                        <span>{Number(editData.price)}</span>
                      </div>

                      <button
                        onClick={() => setEditData(prev => ({ ...prev, price: Number(prev.price) + 1 }))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-90 transition-all shadow-md"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {/* Stock or Availability control */}
                  <div className="flex items-center gap-3">
                    {editStock !== null ? (
                      <div className="flex items-center bg-emerald-50 p-1 rounded-xl border border-emerald-200 shadow-inner">
                        <button
                          onClick={() => setEditStock(prev => Math.max(0, (prev || 0) - 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-red-50 active:scale-90 transition-all shadow-sm"
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>
                        <div className="w-12 text-center text-sm font-black text-slate-800 tabular-nums flex items-center justify-center gap-1 text-emerald-700">
                          <Package size={12} />
                          <span>{editStock}</span>
                        </div>
                        <button
                          onClick={() => setEditStock(prev => (prev || 0) + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-90 transition-all shadow-md"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs font-bold text-slate-400">זמין במלאי:</span>
                        <input
                          type="checkbox"
                          checked={editIsInStock}
                          onChange={e => setEditIsInStock(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Normal view: show image thumbnail or fallback to icon */}
                {(() => {
                  const currentImageUrl = enhancedPhoto || capturedPhoto || editData?.image_url || selectedItem?.image || selectedItem?.image_url;
                  
                  if (currentImageUrl) {
                    return (
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 border border-orange-100">
                        <img src={currentImageUrl} alt={selectedItem?.name} className="w-full h-full object-cover" />
                      </div>
                    );
                  }
                  
                  return (
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner flex-shrink-0 bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500">
                      <Coffee size={20} strokeWidth={2.5} />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    {selectedItem.name}
                    {itemQuantity > 1 && (
                      <span className="text-red-600 animate-pulse border-r-2 border-red-600/20 pr-2 mr-1">
                        x{itemQuantity}
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-400">התאמה אישית</p>
                </div>
              </div>
            )}

            {/* Edit Button (only in normal mode) / Quantity Selector */}
            <div className="mr-auto flex items-center gap-2">
              {!isEditMode && (
                <button
                  onClick={() => setShowPinModal(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50 active:scale-90 transition-all"
                  title="עריכת פריט"
                >
                  <Pencil size={16} strokeWidth={2.5} />
                </button>
              )}

              {!isEditMode && (
                <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100/50 shadow-inner">
                  <button
                    onClick={() => setItemQuantity(prev => (prev > 1 ? prev - 1 : 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-90 transition-all shadow-sm"
                  >
                    <Minus size={18} strokeWidth={3} />
                  </button>

                  <div className="w-12 text-center text-lg font-black text-slate-800 tabular-nums">
                    {itemQuantity}
                  </div>

                  <button
                    onClick={() => setItemQuantity(prev => prev + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-black active:scale-90 transition-all shadow-md"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit Mode: Inline Controls */}
          {isEditMode && editData && (
            <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 space-y-3">

              {/* Edit Mode Tab Bar */}
              <div className="flex items-center gap-1 -mx-1">
                {[
                  { key: 'modifiers', label: 'מודיפיירים' },
                  { key: 'recipe', label: 'מתכון' },
                  { key: 'training', label: 'למד מוצר' },
                  { key: 'advanced', label: 'מתקדם' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setEditTab(tab.key);
                      if (tab.key === 'recipe') { setShowRecipe(false); setShowTraining(false); }
                      if (tab.key === 'training') { setShowRecipe(false); setShowTraining(false); }
                    }}
                    className={`flex-1 flex items-center justify-center py-2 rounded-lg text-[13px] font-bold transition-all ${
                      editTab === tab.key
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                        : 'bg-white/80 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Studio enhancement progress */}
              {(isEnhancing || enhanceProgress) && (
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isEnhancing 
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' 
                    : enhancedPhoto
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-slate-50 border border-slate-200 text-slate-600'
                }`}>
                  {isEnhancing ? (
                    <Loader2 size={14} className="animate-spin text-yellow-500" />
                  ) : enhancedPhoto ? (
                    <Sparkles size={14} className="text-green-500" />
                  ) : (
                    <AlertCircle size={14} className="text-slate-400" />
                  )}
                  <span>{enhanceProgress}</span>
                </div>
              )}

              {/* Background enhancement status from parent */}
              {!isEnhancing && !enhanceProgress && selectedItem && enhancingItems[selectedItem?.id || selectedItem?.menu_item_id] === 'enhancing' && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 transition-all">
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                  <span>🎨 שדרוג תמונה ברקע... התמונה תתעדכן אוטומטית</span>
                </div>
              )}
              {!isEnhancing && !enhanceProgress && selectedItem && enhancingItems[selectedItem?.id || selectedItem?.menu_item_id] === 'done' && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 border border-green-200 text-green-700 transition-all">
                  <Sparkles size={14} className="text-green-500" />
                  <span>✅ התמונה שודרגה בהצלחה!</span>
                </div>
              )}
            </div>
          )}

          {/* PIN Code Modal */}
          <PinCodeModal
            isOpen={showPinModal}
            onClose={() => setShowPinModal(false)}
            onSuccess={handlePinSuccess}
            featureName="עריכת פריט מהיר"
          />

          {/* AI Detection Banner */}
          {aiDetection && (
            <div style={{
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              padding: '12px 16px',
              borderRadius: 12,
              margin: '12px 12px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              direction: 'rtl'
            }}>
              {aiDetection.capturedBlob ? (
                <img
                  src={URL.createObjectURL(aiDetection.capturedBlob)}
                  alt="captured"
                  style={{
                    width: 48, height: 48,
                    borderRadius: 10,
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.3)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span style={{ fontSize: 24 }}>🤖</span>
              )}
              <div>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  זוהה: {aiDetection.productName}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  ביטחון: {Math.round(aiDetection.confidence * 100)}% · וקטורים: {aiDetection.vectorCount}/10
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px]">

            {/* 🔥 HERO: Clerk Selection (Mandatory for CONDITIONAL items) */}
            {isConditional && (
              <section className="mb-4 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-orange-50/50 p-2.5 rounded-3xl border-2 border-orange-200/50 shadow-sm relative overflow-hidden">
                  {/* Subtle background glow */}
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-orange-400/10 blur-xl"></div>
                  
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></div>
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">חובה: בחירת מצב הכנה</span>
                  </div>

                  <div className="flex gap-2">
                    <MilkCard
                      label="לקוח קיבל מוכן"
                      Icon={Package}
                      price={0}
                      isSelected={clerkChoice === 'GRAB_AND_GO'}
                      onClick={() => setClerkChoice('GRAB_AND_GO')}
                    />
                    <MilkCard
                      label="נדרשת הכנה"
                      Icon={ChefHat}
                      price={0}
                      isSelected={clerkChoice === 'MADE_TO_ORDER'}
                      onClick={() => setClerkChoice('MADE_TO_ORDER')}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 1. Hero Section (Milk OR Coffee Type depending on item) — hidden in edit mode */}
            {!isEditMode && heroGroup && heroGroup.values && (
              <section className="order-first mb-4">
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex gap-2">
                    {(() => {
                      const seen = new Set();
                      const hideDefault = heroGroup.show_default === false;
                      let values = heroGroup.values?.filter(value => {
                        const name = (value.name || '').toLowerCase();

                        // If show_default is false, hide default/רגיל values
                        if (hideDefault && (value.is_default || name.includes('רגיל') || name.includes('default'))) return false;

                        // Always filter out juices and chocolate drinks/mixes if it's milk
                        // BUT if it's Coffee Type (short/long), allow them.
                        if (heroType === 'milk') {
                          if (name.includes('תפוזים') || name.includes('לימונענע') || name.includes('גזר') || name.includes('תפוח')) return false;
                          if (name.includes('שוקו')) return false;
                          // Filter out special modifiers (decaf, dismantled) if they appear in milk group
                          if (name.includes('נטול קפאין') || name.includes('מפורק')) return false;
                          if (name.includes('ללא')) return false;
                        }

                        const shortName = name.includes('סויה') ? 'סויה' :
                          name.includes('שיבולת') ? 'שיבולת' :
                            name.includes('שקדים') ? 'שקדים' :
                              name.includes('רגיל') ? 'רגיל' : name;

                        if (heroType === 'milk') {
                          if (seen.has(shortName)) return false;
                          seen.add(shortName);
                        }
                        return true;
                      }) || [];

                      // Sort logic
                      values.sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();

                        const getScore = (n) => {
                          if (n.includes('רגיל')) return 10;
                          if (n.includes('שיבולת')) return 9;
                          if (n.includes('סויה')) return 8;
                          if (n.includes('שקדים')) return 7;

                          // Coffee Type scores
                          if (n.includes('קצר')) return 6;
                          if (n.includes('ארוך') && !n.includes('כפול')) return 5;
                          if (n.includes('כפול')) return 4;
                          return 0;
                        };

                        return getScore(bName) - getScore(aName); // Descending score
                      });

                      // Deterministic Layout Logic based on Type
                      const isEspressoLayout = heroType === 'coffee-type';

                      return (
                        <div className={isEspressoLayout ? "grid grid-cols-2 gap-2 w-full" : "flex gap-2 w-full"}>
                          {values.map(value => {
                            let displayName = value.name;
                            // Clean names for milk
                            if (heroType === 'milk') {
                              if (displayName.includes('סויה')) displayName = 'סויה';
                              else if (displayName.includes('שיבולת')) displayName = 'שיבולת';
                              else if (displayName.includes('שקדים')) displayName = 'שקדים';
                              else if (displayName.includes('רגיל')) displayName = 'רגיל';
                            }

                             // 🥛 MILK RULE: Forces single-select behavior for Milk
                             const groupTitle = (heroGroup?.title || heroGroup?.name || '').toLowerCase();
                             const isMilkLocal = ['חלב', 'milk', 'תחליף'].some(k => groupTitle.includes(k)) || 
                                               heroGroup?.values?.some(v => (v.name || '').toLowerCase().includes('סויה') || (v.name || '').toLowerCase().includes('שיבולת'));
                             
                             const isMulti = !isMilkLocal && (heroGroup?.is_multiple_select || heroGroup?.type === 'multi');
                             const currentSelection = optionSelections[heroGroup?.id];
                             const isSelected = isMulti 
                               ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                               : String(currentSelection) === String(value.id);
                             const IconComponent = getIconForValue(value.name, heroType === 'milk' ? 'milk' : 'general');
                             const effectivePrice = value.priceAdjustment || 0;
                             const autoEmoji = detectGroupIcon(value.name);

                             return (
                               <MilkCard
                                 key={value.id}
                                 label={displayName}
                                 Icon={IconComponent}
                                 emoji={autoEmoji !== '📋' ? autoEmoji : undefined}
                                 price={effectivePrice}
                                 isSelected={isSelected}
                                 onClick={() => toggleOption(heroGroup?.id, String(value.id))}
                               />
                             );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </section>
            )}

            {/* Loading State */}
            {isLoadingOptions && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            )}

            {/* Modifier Groups — Edit Mode */}
            {isEditMode && editData && (() => {
              if (editTab !== 'modifiers') return null;
              const activeGroup = editGroups[activeGroupIdx];
              
              return (
                <div className="mb-4 min-h-[350px]" dir="rtl">
                  {/* Group Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
                    {editGroups.map((group, idx) => (
                      <button
                        key={group.id || idx}
                        onClick={() => { setActiveGroupIdx(idx); setIsAddingItemToGroup(false); setLinkingItemKey(null); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverGroupIdx(idx); }}
                        onDragLeave={() => setDragOverGroupIdx(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverGroupIdx(null);
                          if (!dragSource || dragSource.groupIdx === idx) return;
                          setEditGroups(prev => {
                            const updated = prev.map(g => ({ ...g, items: [...(g.items || [])] }));
                            const [movedItem] = updated[dragSource.groupIdx].items.splice(dragSource.itemIdx, 1);
                            // If moving to a different group, unset isDefault
                            movedItem.isDefault = false;
                            updated[idx].items.push(movedItem);
                            return updated;
                          });
                          setDragSource(null);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border-2 ${
                          activeGroupIdx === idx
                            ? 'bg-indigo-500 text-white border-indigo-500 shadow-md'
                            : dragOverGroupIdx === idx
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-400 scale-105'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        {group.name || 'קבוצה'}({(group.items || []).length})
                      </button>
                    ))}
                    {/* Add Group Button */}
                    <button
                      onClick={() => setShowGroupPicker(!showGroupPicker)}
                      className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 border-dashed border-indigo-300 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 active:scale-90"
                    >
                      + קבוצה
                    </button>
                  </div>

                  {/* Group Picker Overlay */}
                  {showGroupPicker && (
                    <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 mb-3 shadow-lg">
                      <p className="text-sm font-bold text-slate-700 mb-3 text-center">בחר סוג קבוצה</p>
                      <div className="grid grid-cols-3 gap-2">
                        {GROUP_TEMPLATES.map((tpl) => {
                          const alreadyExists = editGroups.some(g => g.name === tpl.name);
                          return (
                            <button
                              key={tpl.name}
                              disabled={alreadyExists && tpl.name !== 'מותאם אישית'}
                              onClick={() => {
                                const newGroup = {
                                  id: `group-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                                  name: tpl.name,
                                  icon: tpl.icon,
                                  type: tpl.type,
                                  show_default: (tpl.name || '').includes('חלב'),
                                  requirement: tpl.requirement || 'M',
                                  items: tpl.type === 'additive' ? [] : [{
                                    id: `item-default-${Date.now()}`,
                                    name: 'רגיל',
                                    price: 0,
                                    isDefault: true,
                                    inventory_item_id: null,
                                  }],
                                };
                                setEditGroups(prev => [...prev, newGroup]);
                                setActiveGroupIdx(editGroups.length);
                                setShowGroupPicker(false);
                              }}
                              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                                alreadyExists && tpl.name !== 'מותאם אישית'
                                  ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 active:scale-95'
                              }`}
                            >
                              <span className="text-2xl">{tpl.icon}</span>
                              <span className="text-[11px] font-bold text-slate-600">{tpl.name}</span>
                              {tpl.type === 'additive' && <span className="text-[9px] text-emerald-500 font-bold">תוספת</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active Group Content */}
                  {activeGroup && (
                    <div>
                      {/* Group Header */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{activeGroup.icon || '📋'}</span>
                          <span className="text-sm font-bold text-slate-700">{activeGroup.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`למחוק את הקבוצה "${activeGroup.name}"?`)) {
                              setEditGroups(prev => prev.filter((_, i) => i !== activeGroupIdx));
                              setActiveGroupIdx(Math.max(0, activeGroupIdx - 1));
                            }
                          }}
                          className="text-red-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Group Settings Row */}
                      <div className="flex items-center gap-3 mb-3 px-1">
                        {/* Show default checkbox — only relevant for replacement groups */}
                        {(activeGroup.type || 'replacement') !== 'additive' && (
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={activeGroup.show_default !== false}
                              onChange={e => {
                                setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                  ...g,
                                  show_default: e.target.checked,
                                }));
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 accent-indigo-500"
                            />
                            <span className="text-[11px] font-medium text-slate-500">הצג ברירת מחדל בהזמנה</span>
                          </label>
                        )}

                        {/* Replacement / Additive toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-0.5 mr-auto">
                          <button
                            onClick={() => setEditGroups(prev => prev.map((g, gi) => {
                              if (gi !== activeGroupIdx) return g;
                              // Switching to replacement: add רגיל if missing
                              const hasDefault = (g.items || []).some(it => it.isDefault || it.is_default);
                              const items = hasDefault ? g.items : [{
                                id: `item-default-${Date.now()}`,
                                name: 'רגיל',
                                price: 0,
                                isDefault: true,
                                inventory_item_id: null,
                              }, ...(g.items || [])];
                              return { ...g, type: 'replacement', items };
                            }))}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              (activeGroup.type || 'replacement') === 'replacement'
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            🔄 החלפה
                          </button>
                          <button
                            onClick={() => setEditGroups(prev => prev.map((g, gi) => {
                              if (gi !== activeGroupIdx) return g;
                              // Switching to additive: remove רגיל default item
                              const items = (g.items || []).filter(it => !(it.isDefault || it.is_default));
                              return { ...g, type: 'additive', items };
                            }))}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              activeGroup.type === 'additive'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            ➕ תוספת
                          </button>
                          <button
                            onClick={() => setEditGroups(prev => prev.map((g, gi) => {
                              if (gi !== activeGroupIdx) return g;
                              // Switching to size: ensure at least one default item
                              let items = [...(g.items || [])];
                              if (!items.some(it => it.isDefault || it.is_default)) {
                                items = [{
                                  id: `item-default-${Date.now()}`,
                                  name: 'רגיל',
                                  price: 0,
                                  isDefault: true,
                                  multiplier: 1.0,
                                  inventory_item_id: null,
                                }, ...items];
                              }
                              return { ...g, type: 'size', items };
                            }))}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              activeGroup.type === 'size'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            📏 גודל
                          </button>
                        </div>
                      </div>

                      {/* Item Tiles */}
                      <div className="flex flex-row flex-nowrap gap-2.5 overflow-x-auto pb-1">
                        {(activeGroup.items || []).map((item, itemIdx) => {
                          const itemKey = item.id || `${activeGroupIdx}-${itemIdx}`;
                          const isDefault = item.isDefault || item.is_default;
                          const invItem = item.inventory_item_id ? inventoryOptions.find(o => o.id === item.inventory_item_id) : null;
                          
                          return (
                            <div
                              key={itemKey}
                              draggable
                              onDragStart={() => setDragSource({ groupIdx: activeGroupIdx, itemIdx })}
                              onDragEnd={() => { setDragSource(null); setDragOverGroupIdx(null); }}
                              className={`relative group flex flex-col items-center justify-center rounded-2xl border-2 p-3 min-h-[100px] shadow-sm flex-1 min-w-[105px] cursor-grab active:cursor-grabbing transition-all ${
                                isDefault
                                  ? 'bg-gradient-to-br from-slate-100 to-slate-50 border-slate-300'
                                  : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                              }`}
                            >
                              {/* Delete button — hidden for default item */}
                              {!isDefault && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                      ...g,
                                      items: g.items.filter((_, ii) => ii !== itemIdx)
                                    }));
                                  }}
                                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 active:scale-90 transition-all z-10"
                                >
                                  <Trash2 size={12} strokeWidth={3} />
                                </button>
                              )}
                              {/* Default badge / Set as default — can only transfer, not remove */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDefault) return; // Can't remove default, only transfer to another item
                                  setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                    ...g,
                                    items: g.items.map((it, ii) => ({
                                      ...it,
                                      isDefault: ii === itemIdx,
                                      is_default: undefined
                                    }))
                                  }));
                                }}
                                className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all z-10 ${
                                  isDefault 
                                    ? 'bg-amber-400 border border-amber-500 text-white cursor-default' 
                                    : 'bg-slate-100 hover:bg-amber-100 text-slate-400 border border-slate-200'
                                }`}
                                title={isDefault ? 'ברירת מחדל' : 'הגדר כברירת מחדל'}
                              >
                                <span className="text-[10px]">{isDefault ? '⭐' : '☆'}</span>
                              </button>
                              {/* Name with auto-icon */}
                              <div className="flex items-center gap-1 justify-center">
                                <span className="text-base">{detectGroupIcon(item.name)}</span>
                                <span className="text-sm font-black text-slate-700 text-center leading-tight">{item.name}</span>
                              </div>
                              {/* Price edit (inline stepper) */}
                              {!isDefault && (
                                <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm mt-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentPrice = Number(item.price) || 0;
                                      const newVal = Math.max(0, currentPrice - 1);
                                      setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                        ...g,
                                        items: g.items.map((it, ii) => ii !== itemIdx ? it : { ...it, price: newVal })
                                      }));
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
                                  >
                                    <Minus size={11} strokeWidth={3} />
                                  </button>

                                  <div className="w-8 text-center text-xs font-black text-slate-800 tabular-nums">
                                    {Number(item.price) || 0}
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentPrice = Number(item.price) || 0;
                                      const newVal = currentPrice + 1;
                                      setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                        ...g,
                                        items: g.items.map((it, ii) => ii !== itemIdx ? it : { ...it, price: newVal })
                                      }));
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 active:scale-90 transition-all"
                                  >
                                    <Plus size={11} strokeWidth={3} />
                                  </button>
                                </div>
                              )}
                              {/* Multiplier edit stepper for size groups */}
                              {activeGroup.type === 'size' && (
                                <div className="flex items-center bg-white p-0.5 rounded-xl border border-amber-200 shadow-sm mt-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentMult = Number(item.multiplier) || (isDefault ? 1.0 : 1.5);
                                      const newVal = Math.max(0.1, Number((currentMult - 0.1).toFixed(1)));
                                      setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                        ...g,
                                        items: g.items.map((it, ii) => ii !== itemIdx ? it : { ...it, multiplier: newVal })
                                      }));
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
                                  >
                                    <Minus size={11} strokeWidth={3} />
                                  </button>

                                  <div className="w-12 text-center text-xs font-black text-amber-700 tabular-nums">
                                    {Number(item.multiplier) || (isDefault ? 1.0 : 1.5)}x
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentMult = Number(item.multiplier) || (isDefault ? 1.0 : 1.5);
                                      const newVal = Number((currentMult + 0.1).toFixed(1));
                                      setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                        ...g,
                                        items: g.items.map((it, ii) => ii !== itemIdx ? it : { ...it, multiplier: newVal })
                                      }));
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 active:scale-90 transition-all"
                                  >
                                    <Plus size={11} strokeWidth={3} />
                                  </button>
                                </div>
                              )}
                              {/* Inventory link button */}
                              <button
                                onClick={() => { setLinkingItemKey(linkingItemKey === itemKey ? null : itemKey); setLinkSearch(''); }}
                                className={`mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 transition-all ${
                                  invItem
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse'
                                }`}
                              >
                                {invItem ? `📦 ${invItem.name}` : '🔗 קשר למלאי'}
                              </button>
                            </div>
                          );
                        })}

                        {/* Add Item Button */}
                        {isAddingItemToGroup ? (
                          <div className="relative flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-indigo-300 p-2.5 min-h-[100px] shadow-sm space-y-1.5 flex-1 min-w-[110px]">
                            <input
                              type="text"
                              value={newItemName}
                              onChange={e => setNewItemName(e.target.value)}
                              placeholder="שם..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 text-center focus:border-indigo-400 outline-none"
                              dir="rtl"
                              lang="he"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && newItemName.trim()) {
                                  const newItem = {
                                    id: `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                                    name: newItemName.trim(),
                                    price: newItemPrice,
                                    isDefault: false,
                                    multiplier: activeGroup.type === 'size' ? 1.5 : undefined,
                                    inventory_item_id: null,
                                  };
                                  setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                    ...g,
                                    items: [...(g.items || []), newItem]
                                  }));
                                  setNewItemName('');
                                  setNewItemPrice(0);
                                  setIsAddingItemToGroup(false);
                                } else if (e.key === 'Escape') {
                                  setIsAddingItemToGroup(false);
                                  setNewItemName('');
                                  setNewItemPrice(0);
                                }
                              }}
                            />
                            <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setNewItemPrice(prev => Math.max(0, prev - 1))}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
                              >
                                <Minus size={11} strokeWidth={3} />
                              </button>
                              <div className="w-8 text-center text-xs font-black text-slate-800 tabular-nums">
                                {newItemPrice}
                              </div>
                              <button
                                onClick={() => setNewItemPrice(prev => prev + 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 active:scale-90 transition-all"
                              >
                                <Plus size={11} strokeWidth={3} />
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  if (!newItemName.trim()) return;
                                  const newItem = {
                                    id: `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                                    name: newItemName.trim(),
                                    price: newItemPrice,
                                    isDefault: false,
                                    inventory_item_id: null,
                                  };
                                  setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                    ...g,
                                    items: [...(g.items || []), newItem]
                                  }));
                                  setNewItemName('');
                                  setNewItemPrice(0);
                                  setIsAddingItemToGroup(false);
                                }}
                                className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 active:scale-90"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => { setIsAddingItemToGroup(false); setNewItemName(''); setNewItemPrice(0); }}
                                className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-300 active:scale-90"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAddingItemToGroup(true)}
                            className="flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-indigo-300 p-3 min-h-[100px] min-w-[70px] text-indigo-400 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 active:scale-90 transition-all"
                          >
                            <Plus size={20} strokeWidth={3} />
                            <span className="text-[9px] font-bold mt-1">הוסף</span>
                          </button>
                        )}
                      </div>

                      {/* Inventory Link Dropdown — shown below tiles */}
                      {linkingItemKey && (() => {
                        // Find which item is being linked
                        const allGroupItems = activeGroup.items || [];
                        const linkingItem = allGroupItems.find(it => (it.id || `${activeGroupIdx}-${allGroupItems.indexOf(it)}`) === linkingItemKey);
                        if (!linkingItem) return null;
                        return (
                          <div className="mt-3 bg-slate-50 rounded-xl border border-slate-200 p-3">
                            <p className="text-[11px] font-bold text-slate-500 mb-2">🔗 קישור &quot;{linkingItem.name}&quot; לפריט מלאי:</p>
                            <input
                              type="text"
                              value={linkSearch}
                              onChange={e => setLinkSearch(e.target.value)}
                              placeholder="חפש פריט מלאי..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none"
                              dir="rtl"
                              lang="he"
                              autoFocus
                            />
                            {linkSearch.length > 0 && (
                              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-white">
                                {inventoryOptions
                                  .filter(opt => opt.name?.toLowerCase().includes(linkSearch.toLowerCase()))
                                  .slice(0, 10)
                                  .map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        // Update the item's inventory_item_id in editGroups
                                        setEditGroups(prev => prev.map((g, gi) => gi !== activeGroupIdx ? g : {
                                          ...g,
                                          items: g.items.map(it => {
                                            const key = it.id || `${gi}-${g.items.indexOf(it)}`;
                                            if (key === linkingItemKey) {
                                              return { ...it, inventory_item_id: opt.id };
                                            }
                                            return it;
                                          })
                                        }));
                                        setLinkingItemKey(null);
                                        setLinkSearch('');
                                      }}
                                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50 text-right border-b border-slate-50 last:border-0"
                                    >
                                      <span className="text-sm font-medium text-slate-700">{opt.name}</span>
                                      <span className="text-[10px] text-slate-400">{opt.display_unit || opt.base_unit || opt.unit || ''}</span>
                                    </button>
                                  ))}
                                {inventoryOptions.filter(opt => opt.name?.toLowerCase().includes(linkSearch.toLowerCase())).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-slate-400 text-center">לא נמצאו פריטים</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Empty State — No Groups */}
                  {editGroups.length === 0 && !showGroupPicker && (
                    <div className="p-5 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="font-bold text-slate-500 text-sm">אין קבוצות מודיפיירים</p>
                      <p className="text-[11px] text-slate-400 mt-1">הוסף קבוצה כדי להגדיר אפשרויות לפריט זה</p>
                      <button
                        onClick={() => setShowGroupPicker(true)}
                        className="mt-3 mx-auto px-4 py-2 rounded-xl bg-indigo-100 border-2 border-dashed border-indigo-300 text-indigo-500 font-bold text-sm hover:bg-indigo-200 active:scale-90 transition-all"
                      >
                        + הוסף קבוצה
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Empty State Message — Normal Mode */}
            {!isEditMode && (optionGroups || []).length === 0 && !isLoadingOptions && (
              <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 mb-4">
                <p className="font-medium">אין תוספות מובנות לפריט זה</p>
                <p className="text-xs mt-1">אבל אפשר לכתוב הערות חופשיות למטה 👇</p>
              </div>
            )}

            {/* 2. Modifiers Grid (Dynamic Columns) — hidden in edit mode */}
            {!isEditMode && (foamGroup || tempGroup || baseGroup || strengthGroup) && (
              <section>
                <div className={`grid gap-4 ${[foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 1
                  ? 'grid-cols-1'
                  : [foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 2
                    ? 'grid-cols-2'
                    : [foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4'
                  }`}>

                  {/* Foam Column */}
                  {foamGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">קצף</p>
                      {foamGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        if (foamGroup.show_default === false && (v.is_default || name.includes('רגיל') || name.includes('default'))) return false;
                        return true;
                      }).map(value => {
                        const isMulti = foamGroup?.is_multiple_select || foamGroup?.type === 'multi';
                        const currentSelection = optionSelections[foamGroup?.id];
                        const isSelected = isMulti 
                          ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                          : String(currentSelection) === String(value.id);
                        const IconComponent = getIconForValue(value.name, 'foam');
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            emoji={detectGroupIcon(value.name) !== '📋' ? detectGroupIcon(value.name) : undefined}
                            isSelected={isSelected}
                            onClick={() => toggleOption(foamGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Temperature Column */}
                  {tempGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">טמפרטורה</p>
                      {tempGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        if (tempGroup.show_default === false && (v.is_default || name.includes('רגיל') || name.includes('default'))) return false;
                        return true;
                      }).map(value => {
                        const isMulti = tempGroup?.is_multiple_select || tempGroup?.type === 'multi';
                        const currentSelection = optionSelections[tempGroup?.id];
                        const isSelected = isMulti 
                          ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                          : String(currentSelection) === String(value.id);
                        const IconComponent = getIconForValue(value.name, 'temp');
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            emoji={detectGroupIcon(value.name) !== '📋' ? detectGroupIcon(value.name) : undefined}
                            isSelected={isSelected}
                            onClick={() => toggleOption(tempGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Base Column */}
                  {baseGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">בסיס</p>
                      {baseGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        if (baseGroup.show_default === false && (v.is_default || name.includes('רגיל') || name.includes('default'))) return false;
                        return true;
                      }).map(value => {
                        const isMulti = baseGroup?.is_multiple_select || baseGroup?.type === 'multi';
                        const currentSelection = optionSelections[baseGroup?.id];
                        const isSelected = isMulti 
                          ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                          : String(currentSelection) === String(value.id);
                        const IconComponent = getIconForValue(value.name, 'base');
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            emoji={detectGroupIcon(value.name) !== '📋' ? detectGroupIcon(value.name) : undefined}
                            isSelected={isSelected}
                            onClick={() => toggleOption(baseGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Strength Column */}
                  {strengthGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">חוזק</p>
                      {strengthGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        if (strengthGroup.show_default === false && (v.is_default || name.includes('רגיל') || name.includes('default'))) return false;
                        return true;
                      }).map(value => {
                        const isMulti = strengthGroup?.is_multiple_select || strengthGroup?.type === 'multi';
                        const currentSelection = optionSelections[strengthGroup?.id];
                        const isSelected = isMulti 
                          ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                          : String(currentSelection) === String(value.id);
                        const IconComponent = getIconForValue(value.name, 'strength');
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            emoji={detectGroupIcon(value.name) !== '📋' ? detectGroupIcon(value.name) : undefined}
                            isSelected={isSelected}
                            onClick={() => toggleOption(strengthGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                </div>
              </section>
            )}

            {otherGroups.length > 0 && !isEditMode && (
              <div className="flex flex-col gap-4">
                {otherGroups
                .filter(group => {
                  // In edit mode, skip JSONB-sourced modifier groups — they're already shown in the tile row above
                  if (isEditMode) {
                    const gid = String(group.id || '');
                    const gname = (group.name || group.title || '').toLowerCase();
                    if (gid.startsWith('json-group-') || gid.startsWith('extras-') || gname === 'תוספות') return false;
                  }
                  return true;
                })
                .map((group) => {
                  const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
                  const hideDefault = group.show_default === false;
                  const visibleOptions = (group.values || []).filter(v => {
                    if (!v.name) return false;
                    const lower = (v.name || '').toLowerCase();
                    // Hide default/רגיל if show_default is false
                    if (hideDefault && (v.is_default || lower.includes('רגיל') || lower === 'default')) return false;
                    // Keep 'מפורק' and 'נטול' filtering as they are handled in the special row
                    if (lower.includes('מפורק')) return false;
                    if (lower.includes('נטול')) return false;
                    return true;
                  });

                  if (visibleOptions.length === 0) return null;

                  // If the only option left is the default/regular option, hide the group
                  if (visibleOptions.length === 1) {
                    const soleOption = visibleOptions[0];
                    const isDefault = soleOption.is_default || 
                                      (soleOption.name || '').includes('רגיל') || 
                                      (soleOption.name || '').toLowerCase() === 'default';
                    if (isDefault) return null;
                  }

                  const shouldHideTitle = (group.name || '').toLowerCase() === 'מותאם אישית' || (group.name || '').toLowerCase() === 'custom';
                  return (
                    <div key={group.id} className={`flex flex-col gap-2 p-3 rounded-2xl shadow-sm border ${isEditMode ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-gray-100'}`}>
                      {!shouldHideTitle && <h4 className="text-sm font-black text-slate-800 px-1">{group.name}</h4>}
                      <div className={`grid gap-2 ${isEditMode
                        ? 'grid-cols-1'
                        : isMultipleSelect
                        ? (visibleOptions.length === 4 ? 'grid-cols-2' : 'grid-cols-3')
                        : (visibleOptions.length === 4 ? 'grid-cols-2' : visibleOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')
                        }`}>
                        {visibleOptions.map(value => {
                          const valueIdStr = String(value.id);
                          let isSelected;
                          if (isMultipleSelect) {
                            const selectedArray = Array.isArray(optionSelections[group.id])
                              ? optionSelections[group.id]
                              : [];
                            isSelected = selectedArray.some(id => String(id) === valueIdStr);
                          } else {
                            isSelected = String(optionSelections[group.id]) === valueIdStr;
                          }

                          const effectivePrice = value.priceAdjustment || 0;
                          const editKey = value.id || value.name;

                          // Edit Mode: show price editor per value
                          if (isEditMode) {
                            return (
                              <div
                                key={value.id}
                                className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-indigo-50/50 border border-indigo-100"
                              >
                                <span className="text-sm font-bold text-slate-700 truncate flex-1">{value.name || value.value_name}</span>
                                <div className="flex items-center bg-white border-2 border-indigo-200 rounded-lg overflow-hidden flex-shrink-0">
                                  <span className="text-xs font-bold text-slate-400 px-1.5">₪</span>
                                  <input
                                    type="number"
                                    value={editModifierPrices[editKey] !== undefined ? editModifierPrices[editKey] : effectivePrice}
                                    onChange={e => setEditModifierPrices(prev => ({ ...prev, [editKey]: e.target.value }))}
                                    className="w-16 text-sm font-bold text-slate-800 py-1 pr-1 pl-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    step="0.5"
                                    min="0"
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={value.id}
                              onClick={() => toggleOption(group.id, String(value.id))}
                              className={`
                                relative flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
                                font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
                                ${isSelected
                                  ? "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100"
                                  : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md"
                                }
                              `}
                            >
                              {(() => {
                                const autoEmoji = detectGroupIcon(value.name || value.value_name || '');
                                if (autoEmoji !== '📋') {
                                  return <span className={`text-2xl transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}>{autoEmoji}</span>;
                                }
                                const IconComponent = getIconForValue(value.name || value.value_name, group.title || group.name);
                                return <IconComponent size={24} strokeWidth={isSelected ? 2.5 : 2} className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`} />;
                              })()}
                              <span className="text-sm text-center">{value.name || value.value_name}</span>
                              {effectivePrice > 0 && (
                                <span className={`text-xs font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
                                  +₪{effectivePrice}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Special Options Row: Decaf | Note - AT BOTTOM (hidden in edit mode — managed via group tabs) */}
            {!isEditMode && <section className="mt-2">
              {(() => {
                const specialOptions = [];
                const isCoffeeItem = selectedItem?.name?.includes('אספרסו') ||
                  selectedItem?.name?.includes('הפוך') ||
                  selectedItem?.name?.includes('מוקה') ||
                  selectedItem?.name?.includes('אמריקנו');

                [...(optionGroups || [])].forEach(group => {
                  group.values?.forEach(val => {
                    if (val.name?.includes('מפורק')) {
                      specialOptions.push({ ...val, groupId: group.id });
                    }
                    if (val.name?.includes('נטול') && isCoffeeItem) {
                      specialOptions.push({ ...val, groupId: group.id });
                    }
                  });
                });

                specialOptions.sort((a, b) => {
                  const aIsDecaf = a.name?.includes('נטול');
                  const bIsDecaf = b.name?.includes('נטול');
                  if (aIsDecaf && !bIsDecaf) return -1;
                  if (!aIsDecaf && bIsDecaf) return 1;
                  return 0;
                });

                const hasSpecialOptions = specialOptions.length > 0;
                const gridCols = hasSpecialOptions ? 'grid-cols-2' : 'grid-cols-1';

                return (
                  <div className={`grid gap-3 ${gridCols}`}>
                    {hasSpecialOptions && (
                      <div className="flex gap-2">
                         {specialOptions.map(value => {
                           const group = (optionGroups || []).find(g => String(g.id) === String(value.groupId));
                           const isMulti = group?.is_multiple_select || group?.type === 'multi';
                           const currentSelection = optionSelections[value.groupId];
                           const isSelected = isMulti 
                             ? (Array.isArray(currentSelection) && currentSelection.includes(String(value.id)))
                             : String(currentSelection) === String(value.id);
                           const IconComponent = getIconForValue(value.name || '', '');
                           const effectivePrice = value.priceAdjustment || 0;
                           const displayName = value.name.includes('נטול') ? 'נטול קפאין' : 'מפורק';

                           return (
                             <button
                               key={value.id}
                               onClick={() => toggleOption(value.groupId, String(value.id))}
                               className={`flex-1 relative flex items-center justify-center gap-2 h-[50px] rounded-xl border transition-all duration-200 ${isSelected
                                 ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-500'
                                 : 'bg-white border-slate-200 hover:border-slate-300'
                                 }`}
                             >
                               <IconComponent size={16} className={isSelected ? 'text-purple-600' : 'text-slate-400'} />
                              <span className={`text-sm font-bold ${isSelected ? 'text-purple-700' : 'text-slate-600'}`}>
                                {displayName}
                              </span>
                              {effectivePrice > 0 && (
                                <span className="text-[10px] text-slate-400 ml-1">+{effectivePrice}₪</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Note Input Pill - Only show if allow_notes is not false AND not in edit mode */}
                    {!isEditMode && selectedItem?.allow_notes !== false && (
                      <div className={`relative flex items-center h-[50px] rounded-xl border transition-all duration-200 ${orderNote.length > 0
                        ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>

                        <input
                          type="text"
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          maxLength={50}
                          placeholder="הוסף הערה"
                          className={`w-full h-full bg-transparent text-center font-bold text-sm focus:outline-none px-2 placeholder:text-slate-400 ${orderNote.length > 0 ? 'text-orange-600' : 'text-slate-800'
                            }`}
                        />

                        {orderNote.length > 0 && (
                          <span className="absolute bottom-1 left-2 text-[9px] text-orange-400 font-medium">
                            {orderNote.length}/50
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>}

            {/* ─── Inline Tab Panels (Edit Mode) ─── */}
            {isEditMode && editTab === 'recipe' && (
              <EditRecipePanel
                isActive={true}
                selectedItem={selectedItem}
                isEditMode={isEditMode}
                recipeIngredients={recipeIngredients}
                inventoryOptions={inventoryOptions}
                ingredientSearch={ingredientSearch}
                setIngredientSearch={setIngredientSearch}
                showIngredientDropdown={showIngredientDropdown}
                setShowIngredientDropdown={setShowIngredientDropdown}
                recipeLoading={recipeLoading}
                editGroups={editGroups}
                addRecipeIngredient={addRecipeIngredient}
                updateIngredientQuantity={updateIngredientQuantity}
                removeRecipeIngredient={removeRecipeIngredient}
                recipeSaveStatus={recipeSaveStatus}
                recipeCostVariant={recipeCostVariant}
                setRecipeCostVariant={setRecipeCostVariant}
              />
            )}
            {isEditMode && editTab === 'training' && (
              <EditTrainingPanel
                isActive={true}
                selectedItem={selectedItem}
                businessId={businessId}
                vectorCount={vectorCount}
                maxVectors={maxVectors}
                trainingStatus={trainingStatus}
                errorDetail={errorDetail}
                trainProduct={trainProduct}
                resetVectors={resetVectors}
              />
            )}
            {isEditMode && editTab === 'advanced' && (
              <EditAdvancedPanel
                isActive={true}
                selectedItem={selectedItem}
                editKdsStation={editKdsStation}
                setEditKdsStation={setEditKdsStation}
                editKdsRouting={editKdsRouting}
                setEditKdsRouting={setEditKdsRouting}
                editIsInStock={editIsInStock}
                setEditIsInStock={setEditIsInStock}
                onItemUpdated={onItemUpdated}
                onClose={onClose}
              />
            )}

            {/* Non-edit-mode: Training button (legacy) */}
            {!isEditMode && (
              <section className="mt-2">
                <button
                  onClick={() => { setShowRecipe(false); setShowTraining(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/60 text-sky-700 font-bold text-sm hover:from-sky-100 hover:to-indigo-100 active:scale-[0.98] transition-all duration-200"
                >
                  <Camera size={18} strokeWidth={2.5} />
                  <span>📷 למד מוצר</span>
                  {vectorCount > 0 && (
                    <span className="text-[10px] bg-sky-200/60 text-sky-700 px-2 py-0.5 rounded-full font-black">
                      {vectorCount}/{maxVectors}
                    </span>
                  )}
                </button>
              </section>
            )}

          </div>
          <div className={`p-3 border-t shadow-[0_-10px_30px_rgba(0,0,0,0.03)] ${isEditMode ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100'}`}>
            {isEditMode ? (
              <div className="flex gap-3">
                <button
                  onClick={() => (selectedItem?._isNewProduct || initialEditMode) ? onClose() : exitEditMode()}
                  disabled={isSaving}
                  className="w-1/3 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors active:scale-95 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={isSaving || editSuccess}
                  className={`flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold shadow-xl transition-all active:scale-98 ${
                    editSuccess
                      ? 'bg-emerald-500 text-white shadow-emerald-200'
                      : isSaving
                        ? 'bg-indigo-300 text-white cursor-wait shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-300/50'
                  }`}
                >
                  {editSuccess ? (
                    <><CheckCircle2 size={18} /> נשמר בהצלחה!</>
                  ) : isSaving ? (
                    <><Loader2 size={18} className="animate-spin" /> שומר...</>
                  ) : (
                    <><Save size={18} /> {selectedItem?._isNewProduct ? 'צור מוצר חדש' : 'שמור שינויים'}</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="w-1/3 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors active:scale-95"
                >
                  ביטול
                </button>
                <button
                  onClick={handleAdd}
                  disabled={(isConditional && !clerkChoice) || selectedItem?.is_in_stock === false || selectedItem?.available === false}
                  className={`flex-1 h-12 rounded-2xl flex items-center justify-between px-6 text-base font-bold shadow-xl transition-all active:scale-98 ${
                    ((isConditional && !clerkChoice) || selectedItem?.is_in_stock === false || selectedItem?.available === false)
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                    : "bg-slate-900 hover:bg-black text-white shadow-slate-300/50"
                  }`}
                >
                  <span>
                    {selectedItem?.is_in_stock === false || selectedItem?.available === false
                      ? "מחוץ למלאי"
                      : isConditional && !clerkChoice 
                        ? "בחר מצב הכנה" 
                        : aiDetection 
                          ? "אשר וקנה ✓" 
                          : "הוסף להזמנה"}
                  </span>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-xl ${
                     ((isConditional && !clerkChoice) || selectedItem?.is_in_stock === false || selectedItem?.available === false) ? "bg-slate-100" : "bg-white/15"
                  }`}>
                    <span>₪{totalPrice}</span>
                    <Check size={16} />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>{/* END front face */}

          {/* ═══ BACK FACE — Training UI (Light Theme) ═══ */}
          <div
            dir="rtl"
            style={{
              display: showTraining ? 'flex' : 'none',
            }}
            className="flex-col w-full h-full sm:max-h-[90vh] bg-[#FAFAFA] rounded-none sm:rounded-[2rem] sm:shadow-2xl overflow-hidden flex-1"
          >
            {/* Back Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Camera size={16} className="text-sky-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">למידת מוצר</h3>
                  <p className="text-[11px] text-slate-500">{selectedItem?.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowTraining(false); resetTraining(); }}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>

            {/* Vector Progress */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500">וקטורים שנלמדו</span>
                <span className={`text-[11px] font-black tabular-nums ${vectorCount >= maxVectors ? 'text-emerald-600' : 'text-sky-600'}`}>
                  {vectorCount} / {maxVectors}
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: maxVectors }, (_, i) => {
                  const isFront = i < 5;
                  const isFilled = i < vectorCount;
                  const isLatest = i === vectorCount - 1 && trainingStatus === 'success';
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${
                        isLatest
                          ? 'bg-emerald-400 scale-y-150 shadow-sm shadow-emerald-300'
                          : isFilled
                            ? isFront ? 'bg-sky-400' : 'bg-indigo-400'
                            : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-sky-500 font-semibold">← חזית (5)</span>
                <span className="text-[9px] text-indigo-500 font-semibold">גב (5) →</span>
              </div>
            </div>

            {/* Camera Preview */}
            <div className="flex-1 px-4 pb-3">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 shadow-inner border border-slate-200">
                <TrainingCameraPreview isActive={showTraining} />

                {/* Status Overlays */}
                {trainingStatus === 'capturing' && (
                  <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 bg-sky-600/90 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                      <Loader2 size={16} className="animate-spin" />
                      <span>מצלם...</span>
                    </div>
                  </div>
                )}
                {(trainingStatus === 'processing' || trainingStatus === 'storing') && (
                  <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 bg-indigo-600/90 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{trainingStatus === 'storing' ? 'שומר...' : 'מעבד AI...'}</span>
                    </div>
                  </div>
                )}
                {trainingStatus === 'success' && (
                  <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 bg-emerald-600/90 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                      <CheckCircle2 size={16} />
                      <span>נלמד! ({vectorCount}/{maxVectors})</span>
                    </div>
                  </div>
                )}
                {trainingStatus === 'error' && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-1 bg-red-600/90 text-white px-4 py-2 rounded-xl shadow-lg">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <AlertCircle size={16} />
                        <span>שגיאה</span>
                      </div>
                      {errorDetail && (
                        <span className="text-[10px] text-red-100 max-w-[200px] text-center">{errorDetail}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Guidance */}
            <p className="text-[10px] text-slate-400 text-center px-5 leading-relaxed font-medium">
              מומלץ לצלם 5 תמונות של <span className="text-sky-600 font-bold">חזית</span> המוצר ו-5 תמונות של <span className="text-indigo-600 font-bold">גב</span> המוצר מזוויות שונות
            </p>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-3">
              {vectorCount > 0 && trainingStatus === 'idle' && (
                <button
                  onClick={() => {
                    if (window.confirm(`למחוק את כל ${vectorCount} הוקטורים של "${selectedItem?.name}"? \nהמוצר לא יזוהה עד שתלמד אותו מחדש.`)) {
                      const itemId = selectedItem?.id || selectedItem?.menu_item_id;
                      const bId = businessId || selectedItem?.business_id;
                      if (itemId && bId) resetVectors(itemId, bId);
                    }
                  }}
                  className="h-12 px-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-colors"
                  title="אפס למידה"
                >
                  <span className="text-sm">🗑️</span>
                  <span className="text-xs font-bold text-red-500">אפס</span>
                </button>
              )}
              <button
                onClick={() => {
                  const itemId = selectedItem?.id || selectedItem?.menu_item_id;
                  const bId = businessId || selectedItem?.business_id;
                  const name = selectedItem?.name;
                  if (itemId && bId) trainProduct(itemId, bId, name);
                }}
                disabled={trainingStatus === 'capturing' || trainingStatus === 'processing' || trainingStatus === 'storing'}
                className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  trainingStatus === 'capturing' || trainingStatus === 'processing' || trainingStatus === 'storing'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : trainingStatus === 'success'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                      : vectorCount >= maxVectors
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200'
                        : 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-200 hover:shadow-xl'
                }`}
              >
                {trainingStatus === 'idle' && vectorCount >= maxVectors && <><CheckCircle2 size={16} /> מלא! צלם להחלפה</>}
                {trainingStatus === 'idle' && vectorCount < maxVectors && <><Camera size={16} /> צלם ולמד ({vectorCount + 1}/{maxVectors})</>}
                {trainingStatus === 'capturing' && <><Loader2 size={16} className="animate-spin" /> מצלם...</>}
                {(trainingStatus === 'processing' || trainingStatus === 'storing') && <><Loader2 size={16} className="animate-spin" /> מעבד...</>}
                {trainingStatus === 'success' && <><CheckCircle2 size={16} /> נלמד! המשך צילום</>}
                {trainingStatus === 'error' && <><AlertCircle size={16} /> נסה שוב</>}
              </button>
            </div>
          </div>{/* END back face */}

          {/* ═══ BACK FACE — Recipe Management UI (Warm Theme) ═══ */}
          <div
            dir="rtl"
            style={{
              display: showRecipe ? 'flex' : 'none',
            }}
            className="flex-col w-full h-full sm:max-h-[90vh] bg-[#FFFBF5] rounded-none sm:rounded-[2rem] sm:shadow-2xl overflow-hidden flex-1"
          >
            {/* Recipe Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-xl border-b border-amber-100/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <BookOpen size={16} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-[15px] text-slate-800">{selectedItem?.name || ''}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">ניהול מתכון</p>
                </div>
              </div>
              <button
                onClick={() => setShowRecipe(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            {/* Recipe Content */}
            {/* Search & Add Ingredient — OUTSIDE scroll container so dropdown isn't clipped */}
            <div className="relative px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-amber-200/60 px-3 py-2.5 shadow-sm">
                <Search size={16} className="text-amber-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="חפש רכיב מהמלאי..."
                  value={ingredientSearch}
                  onChange={(e) => {
                    setIngredientSearch(e.target.value);
                    setShowIngredientDropdown(true);
                  }}
                  onFocus={() => setShowIngredientDropdown(true)}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-300"
                />
                {ingredientSearch && (
                  <button onClick={() => { setIngredientSearch(''); setShowIngredientDropdown(false); }} className="text-slate-300 hover:text-slate-500">
                    <X size={14} />
                  </button>
                )}
              </div>
              
              {/* Dropdown */}
              {showIngredientDropdown && ingredientSearch.length > 0 && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 mx-5 bg-white rounded-xl border border-amber-100 shadow-xl max-h-48 overflow-y-auto">
                  {inventoryOptions
                    .filter(opt => opt.name?.toLowerCase().includes(ingredientSearch.toLowerCase()))
                    .slice(0, 15)
                    .map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => addRecipeIngredient(opt)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-right transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span className="text-sm font-medium text-slate-700">{opt.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">{opt.display_unit || opt.base_unit || ''}</span>
                          {opt.price > 0 && <span className="text-[11px] text-amber-600 font-bold">₪{opt.price.toFixed(2)}</span>}
                          <Plus size={14} className="text-amber-500" />
                        </div>
                      </button>
                    ))
                  }
                  {inventoryOptions.filter(opt => opt.name?.toLowerCase().includes(ingredientSearch.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">לא נמצאו רכיבים</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4" style={{ maxHeight: '45vh' }}>

              {/* Loading State */}
              {recipeLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-amber-500">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-medium">טוען מתכון...</span>
                </div>
              )}

              {/* Empty State — only show if no recipe ingredients AND no modifier groups with linked items */}
              {!recipeLoading && recipeIngredients.length === 0 && (() => {
                const groups = isEditMode ? editGroups : (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []);
                const hasLinkedModifiers = groups.some(g => (g.items || []).some(item => item.inventory_item_id));
                if (hasLinkedModifiers) return null;
                return (
                  <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-400">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                      <BookOpen size={24} className="text-amber-300" />
                    </div>
                    <p className="text-sm font-medium">אין רכיבים במתכון</p>
                    <p className="text-[11px] text-slate-300">חפש והוסף רכיבים מהמלאי</p>
                  </div>
                );
              })()}

              {/* Modifier Groups — each replacement group shown separately */}
              {(() => {
                // Use editGroups if in edit mode, otherwise use selectedItem.modifiers
                const groups = isEditMode ? editGroups : (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []);
                const replacementGroups = groups.filter(g => (g.type || 'replacement') === 'replacement' && (g.items || []).length > 0);
                const additiveGroups = groups.filter(g => g.type === 'additive' && (g.items || []).length > 0);
                
                if (replacementGroups.length === 0 && additiveGroups.length === 0) return null;
                
                return (
                  <>
                    {/* Replacement Groups — each with its own tabs */}
                    {replacementGroups.map((group, groupIdx) => {
                      // Collect linked inventory items for this group
                      const groupLinkedItems = [];
                      let groupDefaultItem = null;
                      
                      (group.items || []).forEach(item => {
                        if (item.inventory_item_id) {
                          const invOpt = inventoryOptions.find(o => o.id === item.inventory_item_id);
                          if (invOpt && !groupLinkedItems.find(m => m.inventory_item_id === item.inventory_item_id)) {
                            const entry = {
                              id: `mod-link-${group.id}-${item.inventory_item_id}`,
                              name: invOpt.name || item.name,
                              inventory_item_id: item.inventory_item_id,
                              unit: invOpt.display_unit || invOpt.base_unit || invOpt.unit || '',
                              price: invOpt.cost_per_unit || invOpt.price || 0,
                              recipe_step: Number(invOpt.recipe_step) || Number(invOpt.quantity_step) || 10,
                              isDefault: item.isDefault || item.is_default,
                              modifierName: item.name
                            };
                            groupLinkedItems.push(entry);
                            if (entry.isDefault) groupDefaultItem = entry;
                          }
                        }
                      });
                      
                      if (groupLinkedItems.length === 0) return null;
                      
                      // Get default's quantity from recipe
                      const defaultRecipeIng = groupDefaultItem 
                        ? recipeIngredients.find(ri => ri.inventory_item_id === groupDefaultItem.inventory_item_id)
                        : null;
                      const defaultQty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : 0;
                      
                      // Active item based on variant selection
                      const variantKey = `group-${group.id}`;
                      const activeItem = recipeCostVariant === variantKey 
                        ? null // No specific variant selected for this group
                        : groupLinkedItems.find(m => m.inventory_item_id === recipeCostVariant) || groupDefaultItem;
                      const finalActiveItem = activeItem || groupDefaultItem;
                      
                      const activeQty = defaultQty || (finalActiveItem?.recipe_step || 10);
                      const activeStep = finalActiveItem?.recipe_step || 10;
                      const activeSubtotal = (finalActiveItem?.price || 0) * activeQty;
                      
                      return (
                        <div key={group.id || groupIdx} className="space-y-2">
                          <div className="flex items-center justify-between px-1 mb-2">
                            <span className="text-[12px] font-bold text-indigo-500 uppercase tracking-wide">
                              {group.icon || '🔗'} {group.name} ({groupLinkedItems.length})
                            </span>
                          </div>
                          
                          {/* Variant selector tabs */}
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {groupLinkedItems.map(item => {
                              const isActive = (!recipeCostVariant && item.isDefault) || recipeCostVariant === item.inventory_item_id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setRecipeCostVariant(item.isDefault ? null : item.inventory_item_id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    isActive
                                      ? 'bg-indigo-500 text-white shadow-md'
                                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                  }`}
                                >
                                  {item.isDefault ? '⭐' : '🔄'} {item.name}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Active variant row */}
                          {finalActiveItem && (
                            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 shadow-sm ${
                              finalActiveItem.isDefault 
                                ? 'bg-white border-amber-100/60' 
                                : 'bg-amber-50/60 border-amber-200/60'
                            }`}>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-slate-700 block truncate">{finalActiveItem.name}</span>
                                <span className="text-[10px] text-slate-400">
                                  {finalActiveItem.unit} | ₪{(finalActiveItem.price * 1000).toFixed(2)}/{finalActiveItem.unit === 'יח׳' ? 'יח׳' : 'ליטר'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-1.5 py-1">
                                <button
                                  onClick={async () => {
                                    if (defaultRecipeIng) {
                                      const newQty = Math.max(activeStep, activeQty - activeStep);
                                      updateIngredientQuantity(defaultRecipeIng.id, newQty);
                                    } else if (finalActiveItem) {
                                      // Auto-create recipe ingredient for this modifier default
                                      await addRecipeIngredient({
                                        id: finalActiveItem.inventory_item_id,
                                        name: finalActiveItem.name,
                                        display_unit: finalActiveItem.unit,
                                        recipe_step: finalActiveItem.recipe_step,
                                        price: finalActiveItem.price,
                                      }, Math.max(activeStep, activeQty - activeStep));
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-sm font-bold text-slate-700 min-w-[40px] text-center">
                                  {activeQty % 1 === 0 ? activeQty : activeQty.toFixed(1)}
                                </span>
                                <button
                                  onClick={async () => {
                                    if (defaultRecipeIng) {
                                      updateIngredientQuantity(defaultRecipeIng.id, activeQty + activeStep);
                                    } else if (finalActiveItem) {
                                      // Auto-create recipe ingredient for this modifier default
                                      await addRecipeIngredient({
                                        id: finalActiveItem.inventory_item_id,
                                        name: finalActiveItem.name,
                                        display_unit: finalActiveItem.unit,
                                        recipe_step: finalActiveItem.recipe_step,
                                        price: finalActiveItem.price,
                                      }, activeQty + activeStep);
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <span className="text-[11px] font-bold text-amber-700 min-w-[45px] text-center">
                                ₪{activeSubtotal.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Additive Groups — shown as extra items */}
                    {additiveGroups.map((group, groupIdx) => {
                      const groupItems = (group.items || []).filter(item => item.inventory_item_id);
                      if (groupItems.length === 0) return null;
                      
                      return (
                        <div key={`additive-${group.id || groupIdx}`} className="space-y-2">
                          <div className="flex items-center px-1 mb-1">
                            <span className="text-[12px] font-bold text-emerald-500 uppercase tracking-wide">
                              {group.icon || '➕'} {group.name} (אופציונלי)
                            </span>
                          </div>
                          {groupItems.map(item => {
                            const invOpt = inventoryOptions.find(o => o.id === item.inventory_item_id);
                            if (!invOpt) return null;
                            const cost = (invOpt.cost_per_unit || invOpt.price || 0) * (Number(invOpt.recipe_step) || 1);
                            return (
                              <div key={item.id} className="flex items-center gap-2 bg-emerald-50/50 rounded-xl border border-emerald-100/60 px-3 py-2 shadow-sm">
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-slate-700 block truncate">{invOpt.name || item.name}</span>
                                  <span className="text-[10px] text-slate-400">{invOpt.unit || ''} | ₪{(invOpt.cost_per_unit || 0).toFixed(2)}/{invOpt.unit || 'יח׳'}</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-600">+₪{cost.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* Ingredient List — filter out ALL modifier-linked items from replacement groups */}
              {!recipeLoading && (() => {
                // Collect ALL modifier-linked inventory IDs from replacement groups
                const modifierLinkedInvIds = new Set();
                const groups = isEditMode ? editGroups : (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []);
                groups.forEach(group => {
                  if ((group.type || 'replacement') === 'replacement') {
                    (group.items || []).forEach(item => {
                      if (item.inventory_item_id) {
                        modifierLinkedInvIds.add(item.inventory_item_id);
                      }
                    });
                  }
                });
                
                const filteredIngredients = recipeIngredients.filter(ing => !modifierLinkedInvIds.has(ing.inventory_item_id));
                if (filteredIngredients.length === 0) return null;
                
                return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">רכיבים ({filteredIngredients.length})</span>
                    {recipeSaveStatus === 'saving' && <span className="text-[11px] text-amber-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> שומר...</span>}
                    {recipeSaveStatus === 'saved' && <span className="text-[11px] text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> נשמר!</span>}
                    {recipeSaveStatus === 'error' && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={12} /> שגיאה</span>}
                  </div>
                  
                  {filteredIngredients.map((ing) => {
                    const invItem = inventoryOptions.find(o => o.id === ing.inventory_item_id);
                    const step = Number(invItem?.recipe_step) || Number(invItem?.quantity_step) || 1;
                    const currentQty = Number(ing.quantity) || 0;
                    return (
                      <div key={ing.id} className="flex items-center gap-2 bg-white rounded-xl border border-amber-100/60 px-3 py-2.5 shadow-sm">
                        {/* Name & Unit */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-700 block truncate">{ing.name}</span>
                          <span className="text-[10px] text-slate-400">{ing.unit} | ₪{ing.price.toFixed(2)}/{ing.unit}</span>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-1.5 py-1">
                          <button
                            onClick={() => updateIngredientQuantity(ing.id, Math.max(step, currentQty - step))}
                            className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold text-slate-700 min-w-[40px] text-center">
                            {currentQty % 1 === 0 ? currentQty : currentQty.toFixed(2)}
                          </span>
                          <button
                            onClick={() => updateIngredientQuantity(ing.id, currentQty + step)}
                            className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        
                        {/* Subtotal */}
                        <span className="text-[11px] font-bold text-amber-700 min-w-[45px] text-center">
                          ₪{ing.subtotal.toFixed(2)}
                        </span>
                        
                        {/* Delete */}
                        <button
                          onClick={() => removeRecipeIngredient(ing.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>

            {/* Recipe Footer — Cost Summary */}
            <div className="px-5 py-3 bg-white/90 backdrop-blur border-t border-amber-100/50">
              {(recipeIngredients.length > 0) && (() => {
                // Calculate base recipe cost
                const baseCost = recipeIngredients.reduce((sum, i) => sum + i.subtotal, 0);
                
                // Calculate modifier variant cost
                let modifierCost = 0;
                const allModItems = [];
                (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []).forEach(group => {
                  (group.items || []).forEach(item => {
                    if (item.inventory_item_id) {
                      const invOpt = inventoryOptions.find(o => o.id === item.inventory_item_id);
                      if (invOpt) allModItems.push({ ...item, price: invOpt.price || 0, isDefault: item.isDefault || item.is_default });
                    }
                  });
                });
                // Find default modifier ingredient in recipe
                const defaultMod = allModItems.find(m => m.isDefault);
                const defaultRecipeIng = defaultMod ? recipeIngredients.find(ri => ri.inventory_item_id === defaultMod.inventory_item_id) : null;
                const modQty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : 0;
                
                if (recipeCostVariant && modQty > 0) {
                  const variant = allModItems.find(m => m.inventory_item_id === recipeCostVariant);
                  if (variant && defaultMod) {
                    // Replace default cost with variant cost for same quantity
                    const defaultCostPart = defaultMod.price * modQty;
                    const variantCostPart = variant.price * modQty;
                    modifierCost = variantCostPart - defaultCostPart;
                  }
                }
                
                const totalCost = baseCost + modifierCost;
                const variantItem = recipeCostVariant ? allModItems.find(m => m.inventory_item_id === recipeCostVariant) : null;
                
                return (
                  <div className="flex flex-col gap-1 mb-3 px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-600">עלות מתכון{variantItem && !variantItem.isDefault ? ` (עם ${variantItem.name || ''})` : ''}כוללת:</span>
                      <span className="text-lg font-black text-amber-700">
                        ₪{totalCost.toFixed(2)}
                      </span>
                    </div>
                    {modifierCost !== 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">הפרש מודיפייר: {modifierCost > 0 ? '+' : ''}₪{modifierCost.toFixed(2)}</span>
                        <span className="text-slate-400">בסיס: ₪{baseCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <button
                onClick={() => setShowRecipe(false)}
                className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200 hover:shadow-xl"
              >
                <Check size={16} /> חזור לפריט
              </button>
            </div>
          </div>{/* END recipe back face */}

          </div>{/* END rotate container */}
        </div>{/* END perspective container */}

        {showImageUploadDialog && (
          <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); setShowImageUploadDialog(false); }}
          >
            <div 
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col gap-4 text-center font-heebo animate-in fade-in zoom-in-95 duration-200" 
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-800">העלאת תמונת מוצר</h3>
              <p className="text-xs text-slate-400">בחר כיצד להוסיף תמונה למוצר</p>
              
              {/* Checkbox for AI bg removal */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 cursor-pointer select-none text-right justify-start">
                <input
                  type="checkbox"
                  checked={autoRemoveBg}
                  onChange={e => handleToggleRemoveBg(e.target.checked)}
                  className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-indigo-950">נקה רקע בעזרת AI</span>
                  <span className="text-[10px] text-indigo-600/80 font-medium">הסר רקע אוטומטית למראה נקי ומקצועי</span>
                </div>
              </label>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowImageUploadDialog(false);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <ImagePlus size={18} />
                  <span>בחירת תמונה מהגלריה או קובץ</span>
                </button>

                <button
                  onClick={() => setShowImageUploadDialog(false)}
                  className="w-full h-12 rounded-2xl border border-slate-200 text-slate-500 font-medium hover:bg-slate-50 active:scale-95 transition-all mt-1"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}
      </div >
    );
  } catch (error) {
    console.error("ModifierModal crashed:", error, error.message, error.stack);
    return null;
  }
};

export default React.memo(ModifierModal);
