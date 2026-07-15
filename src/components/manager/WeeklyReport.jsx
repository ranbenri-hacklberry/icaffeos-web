import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, 
  Printer, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Percent, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

// ── CONFIG & CONSTANTS ──
// ── CONFIG & CONSTANTS ──
const DAYS_OF_WEEK = [
  { index: 0, label: "א׳", key: "sun" },
  { index: 1, label: "ב׳", key: "mon" },
  { index: 2, label: "ג׳", key: "tue" },
  { index: 3, label: "ד׳", key: "wed" },
  { index: 4, label: "ה׳", key: "thu" },
  { index: 5, label: "ו׳", key: "fri" }
];

const WEEKS_OF_MONTH = [
  { index: 1, label: "שב׳ 1", key: "w1" },
  { index: 2, label: "שב׳ 2", key: "w2" },
  { index: 3, label: "שב׳ 3", key: "w3" },
  { index: 4, label: "שב׳ 4", key: "w4" },
  { index: 5, label: "שב׳ 5", key: "w5" }
];

const getPeriodColumnKey = (date, periodStart, mode) => {
  if (mode === 'monthly') {
    const diffMs = date.getTime() - periodStart.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `w${Math.min(5, Math.max(1, weekNum))}`;
  } else {
    const dayOfWeek = date.getDay();
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
    return dayKeys[dayOfWeek] || 'fri';
  }
};

export const WeeklyReport = ({ initialWeekOffset = -1 }) => {
  const { currentUser } = useAuth();
  
  // reportMode state - default to weekly initially but switches to last full month as default when switching mode
  const [reportMode, setReportMode] = useState('weekly'); // 'weekly' | 'monthly'

  // Date selection state - default to -1 (last week/last month)
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(-1);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [menuItems, setMenuItems] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // SMS status
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // 'success' | 'error' | null

  // Category selection pill filter
  const [selectedCategory, setSelectedCategory] = useState(null);

  // ── REPORT PERIOD CALCULATOR ──
  const getReportPeriodRange = (offset, mode) => {
    const today = new Date();
    if (mode === 'monthly') {
      const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      start.setHours(0, 0, 0, 0);
      let end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      // If the target month is the current month, cap the end date to today!
      if (start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear()) {
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
      }
      return { start, end };
    } else {
      const day = today.getDay(); // 0 = Sun, 1 = Mon, etc.
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - day + (offset * 7));
      sunday.setHours(0, 0, 0, 0);
      const friday = new Date(sunday);
      friday.setDate(sunday.getDate() + 5);
      friday.setHours(23, 59, 59, 999);
      return { start: sunday, end: friday };
    }
  };

  const periodRange = useMemo(() => getReportPeriodRange(selectedWeekOffset, reportMode), [selectedWeekOffset, reportMode]);
  const activeWeek = periodRange;

  // ── DATA PROCESSING (MATRIX CALCULATION) ──
  const processedData = useMemo(() => {
    // 1. Create a map of menu_item_id -> daily/weekly quantities and total revenues
    const salesMap = {};
    let totalRevenue = 0;
    let totalOrders = salesData.length;

    salesData.forEach(order => {
      const isOth = order.payment_method === 'oth';
      totalRevenue += isOth ? 0 : Number(order.total || 0);

      (order.order_items || []).forEach(item => {
        const itemName = item.menu_items?.name || item.name;
        if (!itemName) return;

        // Find menu item by name in menuItems
        const menuItem = menuItems.find(mi => mi.name?.trim().toLowerCase() === itemName.trim().toLowerCase());
        if (!menuItem) return;

        const itemId = menuItem.id;

        if (!salesMap[itemId]) {
          salesMap[itemId] = {
            // For weekly
            sun: { qty: 0, rev: 0 },
            mon: { qty: 0, rev: 0 },
            tue: { qty: 0, rev: 0 },
            wed: { qty: 0, rev: 0 },
            thu: { qty: 0, rev: 0 },
            fri: { qty: 0, rev: 0 },
            // For monthly
            w1: { qty: 0, rev: 0 },
            w2: { qty: 0, rev: 0 },
            w3: { qty: 0, rev: 0 },
            w4: { qty: 0, rev: 0 },
            w5: { qty: 0, rev: 0 },
            totalQty: 0,
            totalRev: 0
          };
        }

        const date = new Date(order.created_at);
        const colKey = getPeriodColumnKey(date, periodRange.start, reportMode);
        
        const qty = Number(item.quantity || 0);
        const price = isOth ? 0 : Number(item.menu_items?.price || item.price || menuItem.price || 0);
        const rev = qty * price;

        if (salesMap[itemId][colKey]) {
          salesMap[itemId][colKey].qty += qty;
          salesMap[itemId][colKey].rev += rev;
        }

        salesMap[itemId].totalQty += qty;
        salesMap[itemId].totalRev += rev;
      });
    });

    // 2. Group by category and calculate category totals
    const categoryMap = {};
    menuItems.forEach(item => {
      const catName = item.category || 'אחר';
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          name: catName,
          items: [],
          totals: {
            sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0,
            w1: 0, w2: 0, w3: 0, w4: 0, w5: 0,
            totalQty: 0,
            totalRev: 0
          }
        };
      }

      const sales = salesMap[item.id] || {
        sun: { qty: 0, rev: 0 },
        mon: { qty: 0, rev: 0 },
        tue: { qty: 0, rev: 0 },
        wed: { qty: 0, rev: 0 },
        thu: { qty: 0, rev: 0 },
        fri: { qty: 0, rev: 0 },
        w1: { qty: 0, rev: 0 },
        w2: { qty: 0, rev: 0 },
        w3: { qty: 0, rev: 0 },
        w4: { qty: 0, rev: 0 },
        w5: { qty: 0, rev: 0 },
        totalQty: 0,
        totalRev: 0
      };

      categoryMap[catName].items.push({
        id: item.id,
        name: item.name,
        sales
      });

      // Add to category totals
      const currentColumns = reportMode === 'monthly' ? WEEKS_OF_MONTH : DAYS_OF_WEEK;
      currentColumns.forEach(col => {
        categoryMap[catName].totals[col.key] += sales[col.key].qty;
      });
      categoryMap[catName].totals.totalQty += sales.totalQty;
      categoryMap[catName].totals.totalRev += sales.totalRev;
    });

    const categories = Object.values(categoryMap).filter(cat => cat.items.length > 0);
    // Sort categories by total revenue so highest-selling show first
    categories.sort((a, b) => b.totals.totalRev - a.totals.totalRev);
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      aov,
      categories
    };
  }, [salesData, menuItems, reportMode, periodRange]);

  useEffect(() => {
    if (processedData.categories && processedData.categories.length > 0) {
      const activeCats = processedData.categories.filter(category => {
        const activeItems = showActiveOnly 
          ? category.items.filter(item => item.sales.totalQty > 0)
          : category.items;
        return activeItems.length > 0;
      });
      if (activeCats.length > 0) {
        if (!selectedCategory || !activeCats.some(c => c.name === selectedCategory)) {
          setSelectedCategory(activeCats[0].name);
        }
      } else {
        setSelectedCategory(processedData.categories[0].name);
      }
    } else {
      setSelectedCategory(null);
    }
  }, [processedData.categories, showActiveOnly]);

  // ── DATA FETCHING ──
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser?.business_id) return;
      setLoading(true);
      setError(null);
      setSmsStatus(null);

      try {
        // 1. Fetch all active menu items
        const { data: items, error: itemsError } = await supabase
          .from('menu_items')
          .select('id, name, price, category')
          .eq('business_id', currentUser.business_id)
          .order('name');
        
        if (itemsError) throw itemsError;
        setMenuItems(items || []);

        // 2. Fetch sales directly from orders table (paginated to bypass Supabase 1000 row limit)
        const sales = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data: pageOrders, error: salesError } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              customer_name,
              total_amount,
              created_at,
              ready_at,
              order_status,
              is_paid,
              payment_method,
              order_items (
                id,
                quantity,
                price,
                menu_items (
                  name,
                  category,
                  price
                )
              )
            `)
            .eq('business_id', currentUser.business_id)
            .gte('created_at', periodRange.start.toISOString())
            .lte('created_at', periodRange.end.toISOString())
            .neq('order_status', 'cancelled')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (salesError) throw salesError;
          if (!pageOrders || pageOrders.length === 0) break;
          sales.push(...pageOrders);
          if (pageOrders.length < pageSize) break;
          page++;
        }

        const mappedSales = sales.map(o => ({
          ...o,
          total: o.total_amount, // Map total_amount to total to maintain compatibility with existing calculation logic
          customer_name: o.customer_name || 'אורח'
        }));

        setSalesData(mappedSales);
      } catch (err) {
        console.error('❌ Error fetching report data:', err);
        setError('שגיאה בטעינת נתוני המכירות. ודא חיבור תקין לרשת.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedWeekOffset, reportMode, currentUser?.business_id]);

  // ── SMS SHARE METHOD ──
  const sendSmsReport = async () => {
    if (!currentUser?.business_id) return;
    setSmsSending(true);
    setSmsStatus(null);

    try {
      // Find employee phone number or prompt
      const phone = currentUser?.whatsapp_phone || currentUser?.phone || '0548317887';
      const startStr = `${activeWeek.start.getDate()}/${activeWeek.start.getMonth() + 1}`;
      const endStr = `${activeWeek.end.getDate()}/${activeWeek.end.getMonth() + 1}`;
      
      const text = `📊 דוח מכירות שבועי (${startStr} - ${endStr})
סה"כ פדיון: ₪${processedData.totalRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
סה"כ הזמנות: ${processedData.totalOrders}
ממוצע להזמנה: ₪${processedData.aov.toFixed(1)}

קישור לצפייה בדוח המלא:
http://${window.location.host}/data-manager-interface?tab=reports&week=${selectedWeekOffset}`;

      console.log('Sending SMS via backend:', { to: phone, text, businessId: currentUser.business_id });

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          text,
          businessId: currentUser.business_id
        })
      });

      const result = await response.json();
      if (result.success) {
        setSmsStatus('success');
      } else {
        throw new Error(result.error || 'Server error');
      }
    } catch (err) {
      console.error('Failed to send SMS report:', err);
      setSmsStatus('error');
    } finally {
      setSmsSending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="text-sm font-bold text-gray-500">טוען את המכירות השבועיות ומכין את הדוח...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-4">
        <AlertTriangle className="text-red-500 mb-2" size={48} />
        <h3 className="text-lg font-bold text-gray-800">תקלה בטעינת הדוח</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">{error}</p>
        <button 
          onClick={() => setSelectedWeekOffset(selectedWeekOffset)} // Trigger refetch
          className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm shadow hover:bg-blue-700 active:scale-95 transition-all"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  const currentColumns = reportMode === 'monthly' ? WEEKS_OF_MONTH : DAYS_OF_WEEK;

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-24 p-4 lg:p-6 max-w-7xl mx-auto w-full" dir="rtl">
      
      {/* ── STYLE BLOCK FOR PRINT MODE ── */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 12px;
          }
          header, nav, footer, button, select, .print\\:hidden {
            display: none !important;
          }
          .print\\:full-width {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print\\:page-break {
            page-break-before: always;
          }
          table {
            page-break-inside: avoid;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* ── MODE SELECTION (שבועי / חודשי) ── */}
      <div className="flex justify-center gap-1 bg-gray-100 p-1.5 rounded-2xl w-fit mx-auto print:hidden shadow-sm">
        <button
          onClick={() => {
            setReportMode('weekly');
            setSelectedWeekOffset(-1); // default to last week
          }}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
            reportMode === 'weekly'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          דוח שבועי
        </button>
        <button
          onClick={() => {
            setReportMode('monthly');
            setSelectedWeekOffset(-1); // default to last full month
          }}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
            reportMode === 'monthly'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          דוח חודשי
        </button>
      </div>

      {/* ── PRINT-ONLY REPORT TITLE HEADER ── */}
      <div className="hidden print:block text-center space-y-1 pb-4 border-b border-gray-200">
        <h1 className="text-xl font-black text-gray-900">דוח מכירות - {currentUser?.business_name || 'עגלת הקפה'}</h1>
        <p className="text-sm font-bold text-gray-500">
          טווח תאריכים: {activeWeek.start.toLocaleDateString('he-IL')} - {activeWeek.end.toLocaleDateString('he-IL')}
        </p>
      </div>

      {/* ── SUMMARY KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
        {/* Card 1: Revenue with Navigation */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl shadow-lg p-5 flex flex-col justify-between h-40 relative overflow-hidden border border-blue-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-100">
              {reportMode === 'monthly' ? 'סה"כ פדיון חודשי' : 'סה"כ פדיון שבועי'}
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
              {reportMode === 'monthly' ? 'חודשי' : 'שבועי'}
            </span>
          </div>

          <div className="flex items-center justify-between my-2 relative z-10">
            <button
              onClick={() => {
                const limit = reportMode === 'monthly' ? -5 : -7;
                if (selectedWeekOffset > limit) setSelectedWeekOffset(prev => prev - 1);
              }}
              disabled={selectedWeekOffset <= (reportMode === 'monthly' ? -5 : -7)}
              className={`p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90 ${
                selectedWeekOffset <= (reportMode === 'monthly' ? -5 : -7) ? 'opacity-20 cursor-not-allowed' : ''
              }`}
            >
              <ChevronRight size={20} />
            </button>

            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">
                ₪{processedData.totalRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-blue-100 font-bold mt-1">
                {(() => {
                  const startStr = `${activeWeek.start.getDate()}/${activeWeek.start.getMonth() + 1}`;
                  const endStr = `${activeWeek.end.getDate()}/${activeWeek.end.getMonth() + 1}`;
                  if (reportMode === 'monthly') {
                    const monthNames = [
                      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
                    ];
                    const targetDate = new Date();
                    targetDate.setMonth(targetDate.getMonth() + selectedWeekOffset);
                    const monthLabel = monthNames[targetDate.getMonth()];
                    const yearLabel = targetDate.getFullYear();
                    return `${monthLabel} ${yearLabel} (${startStr} - ${endStr})`;
                  } else {
                    const label = selectedWeekOffset === 0 ? 'השבוע הנוכחי' : selectedWeekOffset === -1 ? 'שבוע שעבר' : `לפני ${Math.abs(selectedWeekOffset)} שבועות`;
                    return `${label} (${startStr} - ${endStr})`;
                  }
                })()}
              </div>
            </div>

            <button
              onClick={() => {
                if (selectedWeekOffset < 0) setSelectedWeekOffset(prev => prev + 1);
              }}
              disabled={selectedWeekOffset >= 0}
              className={`p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90 ${
                selectedWeekOffset >= 0 ? 'opacity-20 cursor-not-allowed' : ''
              }`}
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          
          <div className="text-[10px] text-blue-200/80 text-center relative z-10">
            {reportMode === 'monthly' ? 'ריכוז ימי השבוע לאורך החודש' : 'מכירות ימי ראשון עד שישי כולל'}
          </div>
        </div>

        {/* Card 2: Orders */}
        <div className="col-span-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between h-28 sm:h-40">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">סה"כ הזמנות</span>
          <div className="text-center my-auto">
            <span className="text-2xl sm:text-4xl font-black tracking-tight text-slate-800">
              {processedData.totalOrders.toLocaleString('he-IL')}
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-gray-450 text-center">עסקאות שבוצעו בקופות ובקיוסק</span>
        </div>

        {/* Card 3: AOV */}
        <div className="col-span-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between h-28 sm:h-40">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">ממוצע להזמנה (AOV)</span>
          <div className="text-center my-auto">
            <span className="text-2xl sm:text-4xl font-black tracking-tight text-slate-800">
              ₪{processedData.aov.toLocaleString('he-IL', { maximumFractionDigits: 1 })}
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-gray-450 text-center">סל קניות ממוצע ללקוח בשבוע זה</span>
        </div>
      </div>

      {/* ── CATEGORY PILLS SELECTOR ── */}
      {processedData.categories && processedData.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-4 pt-2 justify-center print:hidden">
          {processedData.categories
            .filter(category => {
              const activeItems = showActiveOnly 
                ? category.items.filter(item => item.sales.totalQty > 0)
                : category.items;
              return activeItems.length > 0;
            })
            .map(category => {
              const isActive = selectedCategory === category.name;
              return (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-black'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{category.name}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* ── CATEGORY TABLES CONTAINER ── */}
      <div className="space-y-6 print:full-width">
        {processedData.categories.map((category, catIdx) => {
          const activeItems = showActiveOnly 
            ? category.items.filter(item => item.sales.totalQty > 0)
            : category.items;
          
          if (activeItems.length === 0) return null;

          const isSelected = selectedCategory === category.name;

          return (
            <div 
              key={category.name} 
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${catIdx > 0 ? 'print:page-break' : ''} ${
                isSelected ? 'block' : 'hidden print:block'
              }`}
            >
              {/* Category Header */}
              <div className="bg-slate-50 border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                <h3 className="font-black text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  <span>{category.name}</span>
                  <span className="text-xs bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                    {activeItems.length} מנות פעילות
                  </span>
                </h3>
                <span className="text-xs sm:text-sm font-black text-blue-600">
                  סה"כ: ₪{category.totals.totalRev.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Table Wrapper - No Scroll on Mobile */}
              <div className="overflow-x-auto sm:overflow-visible">
                <table className="w-full text-right border-collapse min-w-0">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="px-2 sm:px-5 py-3 text-right">שם המנה</th>
                      {currentColumns.map(col => (
                        <th key={col.key} className="px-1 sm:px-3 py-3 text-center w-8 sm:w-16">{col.label}</th>
                      ))}
                      <th className="px-1 sm:px-4 py-3 text-center w-12 sm:w-24">סה"כ כמות</th>
                      <th className="px-2 sm:px-5 py-3 text-left w-20 sm:w-28">סה"כ פדיון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeItems]
                      .sort((a, b) => b.sales.totalRev - a.sales.totalRev)
                      .map(item => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-slate-50/40 text-[11px] sm:text-xs text-gray-700 transition-colors">
                          {/* Item Name */}
                          <td className="px-2 sm:px-5 py-3 font-bold text-slate-800 break-words max-w-[120px] sm:max-w-none">
                            <div>{item.name}</div>
                            <div className="text-[9px] text-blue-600 font-black sm:hidden mt-0.5">
                              {item.sales.totalQty} יח׳ | ₪{item.sales.totalRev.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                            </div>
                          </td>
                          
                          {/* Days/Weeks Sales Quantity */}
                          {currentColumns.map(col => {
                            const qty = item.sales[col.key].qty;
                            return (
                              <td 
                                key={col.key} 
                                className={`px-1 sm:px-3 py-3 text-center ${qty > 0 ? 'font-black text-slate-900 bg-blue-50/10' : 'text-gray-300'}`}
                              >
                                {qty > 0 ? qty : '-'}
                              </td>
                            );
                          })}

                          {/* Total Qty */}
                          <td className="px-1 sm:px-4 py-3 text-center font-black text-slate-900 bg-slate-50/30">
                            {item.sales.totalQty}
                          </td>

                          {/* Total Revenue */}
                          <td className="px-2 sm:px-5 py-3 text-left font-black text-slate-900 bg-slate-50/50">
                            ₪{item.sales.totalRev.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                    ))}

                    {/* Category Totals Row */}
                    <tr className="bg-slate-50/80 font-black text-slate-900 text-[11px] sm:text-xs border-t-2 border-slate-100">
                      <td className="px-2 sm:px-5 py-4">סה"כ</td>
                      
                      {/* Days/Weeks Total Quantities */}
                      {currentColumns.map(col => (
                        <td key={col.key} className="px-1 sm:px-3 py-4 text-center">
                          {category.totals[col.key]}
                        </td>
                      ))}

                      {/* Total Qty */}
                      <td className="px-1 sm:px-4 py-4 text-center bg-slate-100/50">
                        {category.totals.totalQty}
                      </td>

                      {/* Total Revenue */}
                      <td className="px-2 sm:px-5 py-4 text-left bg-slate-100/80 text-blue-600">
                        ₪{category.totals.totalRev.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default WeeklyReport;
