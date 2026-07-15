import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor, ChefHat, BarChart3, Package, Palette, Coffee, List,
  Truck, Settings, LayoutGrid,
  CheckCircle, Square, Eye, Save, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Define all available apps with their metadata
const AVAILABLE_APPS = [
  {
    id: 'manager',
    name: 'תקוקפיט (Dashboard)',
    description: 'מכירות, מפריט, מלאי ומשימות',
    icon: BarChart3,
    color: 'purple',
    minAccessLevel: null // Available to all
  },
  {
    id: 'kiosk',
    name: 'עמדת קופה',
    description: 'הקלדת הזמנות ומכירה',
    icon: Monitor,
    color: 'orange',
    minAccessLevel: null
  },
  {
    id: 'kds',
    name: 'סרטונים (KDS)',
    description: 'ניהול ההזמנות ומשימות',
    icon: Coffee,
    color: 'teal',
    minAccessLevel: null
  },
  {
    id: 'prep',
    name: 'הכנות ומשימות',
    description: 'פתיחה, סגירה ומשימות יום',
    icon: ChefHat,
    color: 'green',
    minAccessLevel: null
  },
  {
    id: 'inventory',
    name: 'ניהול מלאי',
    description: 'ספירות מלאי וקבלת סחורה',
    icon: Package,
    color: 'indigo',
    minAccessLevel: null
  },
  {
    id: 'menu-editor',
    name: 'עריכת תפריט',
    description: 'עדכון פריטים, מחירים ותמונות',
    icon: Palette,
    color: 'rose',
    minAccessLevel: null
  },
  {
    id: 'mobile-kds',
    name: 'תכנות וייצור',
    description: 'פתיחה, סגירה ומשימות יום',
    icon: List,
    color: 'cyan',
    minAccessLevel: null
  },
  {
    id: 'kanban',
    name: 'קנבן הזמנות',
    description: 'ניהול הזמנות ומשלוחים',
    icon: LayoutGrid,
    color: 'emerald',
    minAccessLevel: null
  },
  {
    id: 'driver',
    name: 'סרטונים',
    description: 'ניהול משלוחים',
    icon: Truck,
    color: 'blue',
    minAccessLevel: 'driver'
  },
  {
    id: 'owner-settings',
    name: 'הגדרות',
    description: 'ניהול עובדים וחנות',
    icon: Settings,
    color: 'amber',
    minAccessLevel: 'owner'
  }
];

const COLOR_CLASSES = {
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  teal: 'bg-teal-50 text-teal-600 border-teal-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200'
};

interface AppVisibilitySettingsProps {
  userId: string;
  userAccessLevel: string;
  isDriver?: boolean;
  isSuperAdmin?: boolean;
}

const AppVisibilitySettings: React.FC<AppVisibilitySettingsProps> = ({
  userId,
  userAccessLevel,
  isDriver = false,
  isSuperAdmin = false
}) => {
  const { currentUser, login } = useAuth();
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Get apps available to this user based on permissions
  const availableApps = AVAILABLE_APPS.filter(app => {
    if (!app.minAccessLevel) return true; // Available to all

    const accessLevel = (userAccessLevel || '').toLowerCase();

    if (isSuperAdmin) return true; // Super admin sees all

    if (app.minAccessLevel === 'driver' && isDriver) return true;

    if (app.minAccessLevel === 'owner') {
      return accessLevel === 'owner' || accessLevel === 'admin' || accessLevel === 'manager';
    }

    return false;
  });

  useEffect(() => {
    loadUserPreferences();
  }, [userId]);

  const loadUserPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('visible_apps')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // If user has saved preferences, use them. Otherwise, show all available apps
      if (data?.visible_apps && Array.isArray(data.visible_apps)) {
        setSelectedApps(data.visible_apps);
      } else {
        // Default: all available apps are selected
        setSelectedApps(availableApps.map(app => app.id));
      }
    } catch (err) {
      console.error('Error loading app preferences:', err);
      // Default: all available apps
      setSelectedApps(availableApps.map(app => app.id));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleApp = (appId: string) => {
    setSelectedApps(prev =>
      prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  const selectAll = () => {
    setSelectedApps(availableApps.map(app => app.id));
  };

  const deselectAll = () => {
    setSelectedApps([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ visible_apps: selectedApps })
        .eq('id', userId);

      if (error) throw error;

      // Update auth context immediately
      if (currentUser && currentUser.id === userId) {
        await login({ ...currentUser, visible_apps: selectedApps });
      }

      setSuccessMessage('העדפות האפליקציות נשמרו בהצלחה! ✅');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving app preferences:', err);
      alert('שגיאה בשמירת ההעדפות');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900 mb-1">אפליקציות במסך הראשי</h3>
          <p className="text-sm text-slate-600 font-medium">
            בחר אילו אפליקציות יופיעו לך במסך הבחירה
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            בחר הכל
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            בטל הכל
          </button>
        </div>
      </div>

      {/* Apps grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableApps.map(app => {
          const Icon = app.icon;
          const isSelected = selectedApps.includes(app.id);
          const colorClass = COLOR_CLASSES[app.color as keyof typeof COLOR_CLASSES];

          return (
            <motion.button
              key={app.id}
              onClick={() => toggleApp(app.id)}
              className={`relative p-4 rounded-xl border-2 transition-all text-right ${isSelected
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-3">
                {/* App Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${colorClass}`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>

                {/* App Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 mb-0.5 truncate">
                    {app.name}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium truncate">
                    {app.description}
                  </p>
                </div>

                {/* Selection Indicator */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckCircle className="w-5 h-5 text-indigo-600" fill="currentColor" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300" />
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Info text */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Eye className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800 font-medium leading-relaxed">
          <span className="font-bold">טיפ:</span> בחר רק את האפליקציות שבהן אתה משתמש באופן קבוע.
          האפליקציות שלא נבחרו לא יופיעו במסך הראשי, אבל תמיד תוכל להחזיר אותן מכאן.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
        >
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800 font-bold">{successMessage}</p>
        </motion.div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>שומר...</span>
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>שמור העדפות</span>
          </>
        )}
      </button>
    </div>
  );
};

export default AppVisibilitySettings;
