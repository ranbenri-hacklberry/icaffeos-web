import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, BarChart3, PieChart, ChevronDown, ChevronUp, Package, X, Phone, User, Clock, Hash, Receipt, Info, RefreshCcw } from 'lucide-react';
import { liveQuery } from 'dexie';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { isKitchenPrep } from '@/utils/kdsUtils';

const PAYMENT_LABELS = {
  cash: '💵 מזומן',
  credit: '💳 אשראי',
  bit: '📱 ביט',
  paybox: '📦 פייבוקס',
  transfer: '🏦 העברה',
  cibus: '🥗 סיבוס',
  givebite: '🎁 GivBite'
};

const SalesDashboard = ({ mode = 'orders' }) => {
  const { currentUser, isAuthenticated } = useAuth();

  console.log('🔍 SalesDashboard Debug:', {
    currentUser,
    isAuthenticated,
    user: currentUser,
    userProfile: currentUser?.user_metadata
  });

  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [currentSales, setCurrentSales] = useState([]); // Data for current period (Flattened Items)
  const [currentRawOrders, setCurrentRawOrders] = useState([]); // Raw Orders for Orders List
  const [previousSales, setPreviousSales] = useState([]); // Data for comparison period
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Navigation State
  const [[dateMs, direction], setDateTuple] = useState([new Date().setHours(0, 0, 0, 0), 0]);
  const selectedDate = useMemo(() => new Date(dateMs), [dateMs]);

  // Active Dates Cache
  const [activeDates, setActiveDates] = useState([]);

  // Graph Selection State (for filtering the list)
  const [selectedGraphBar, setSelectedGraphBar] = useState(null); // { key: string|int, type: 'hour'|'day' }

  // Category Accordion State
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Orders List Accordion State
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());

  // SMS logs Cache State
  const [smsCache, setSmsCache] = useState({});

  // Today's SMS logs list
  const [todaySmsLogs, setTodaySmsLogs] = useState([]);

  // Active status filter for the Orders view
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('in_progress'); // 'in_progress', 'ready', 'completed'

  // Helper to format currency
  const formatCurrency = (amount) => `₪${amount.toFixed(0)}`;

  const toggleCategory = (cat) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setExpandedCategories(newSet);
  };

  const fetchSmsStatus = async (phone, orderStatus, force = false) => {
    if (!phone) return;
    
    const cleanPhone = phone.trim();
    if (cleanPhone.startsWith('GUEST_')) {
      setSmsCache(prev => ({
        ...prev,
        [cleanPhone]: { status: 'guest', loading: false }
      }));
      return;
    }
    
    const cached = smsCache[cleanPhone];
    const isFinalState = cached && (cached.status === 'success' || cached.status === 'guest');
    
    if (!force && isFinalState) {
      return;
    }
    
    if (orderStatus !== 'completed' && orderStatus !== 'ready' && !force) {
      setSmsCache(prev => ({
        ...prev,
        [cleanPhone]: { status: 'pending_order', loading: false }
      }));
      return;
    }
    
    setSmsCache(prev => ({
      ...prev,
      [cleanPhone]: { ...(prev[cleanPhone] || {}), loading: true }
    }));
    
    try {
      const response = await fetch(`/api/admin/sms-logs?phone=${encodeURIComponent(cleanPhone)}`);
      const data = await response.json();
      
      if (data && data.success && data.logs && data.logs.length > 0) {
        const mostRecent = data.logs[0];
        setSmsCache(prev => ({
          ...prev,
          [cleanPhone]: {
            status: mostRecent.status,
            error: mostRecent.error,
            sentAt: mostRecent.sent_at || mostRecent.created_at,
            loading: false
          }
        }));
      } else {
        setSmsCache(prev => ({
          ...prev,
          [cleanPhone]: { status: 'none', loading: false }
        }));
      }
    } catch (err) {
      console.error('Failed to fetch SMS status:', err);
      setSmsCache(prev => ({
        ...prev,
        [cleanPhone]: { status: 'error_fetch', error: err.message, loading: false }
      }));
    }
  };

  const toggleOrder = (orderId) => {
    const newSet = new Set(expandedOrderIds);
    const isExpanding = !newSet.has(orderId);
    if (isExpanding) {
      newSet.add(orderId);
      const order = currentRawOrders.find(o => o.id === orderId);
      if (order && order.customer_phone) {
        fetchSmsStatus(order.customer_phone, order.order_status || order.orderStatus);
      }
    } else {
      newSet.delete(orderId);
    }
    setExpandedOrderIds(newSet);
  };

  // Fetch Active Dates on Mount
  useEffect(() => {
    const fetchActiveDates = async () => {
      try {
        const { data, error } = await supabase.rpc('get_active_sales_dates', {
          p_business_id: currentUser?.business_id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          // RPC returns array of ISO date strings (YYYY-MM-DD)
          // We need to convert them to .toDateString() format to match existing navigation logic
          const datesList = data.map(d => new Date(d).toDateString());
          setActiveDates(datesList);

          const todayStr = new Date().toDateString();
          if (!datesList.includes(todayStr) && datesList.length > 0) {
            const mostRecent = new Date(datesList[0]);
            mostRecent.setHours(0, 0, 0, 0);
            setDateTuple([mostRecent.getTime(), 0]);
          }
        }
      } catch (e) {
        console.error('Error fetching active dates:', e);
      }
    };
    fetchActiveDates();
  }, [currentUser?.business_id]);

  // Navigation Logic
  const getDateRanges = (mode, date) => {
    const now = new Date();
    const currentStart = new Date(date);
    const currentEnd = new Date(date);
    const previousStart = new Date(date);
    const previousEnd = new Date(date);

    if (mode === 'daily') {
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);
      previousStart.setTime(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      previousEnd.setTime(currentEnd.getTime() - (7 * 24 * 60 * 60 * 1000));
    } else if (mode === 'weekly') {
      const day = currentStart.getDay();
      currentStart.setDate(currentStart.getDate() - day);
      currentStart.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(currentStart);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // ALWAYS fetch the full week for calculation purposes
      currentEnd.setTime(endOfWeek.getTime());

      // Previous week logic
      previousStart.setTime(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      previousEnd.setTime(currentEnd.getTime() - (7 * 24 * 60 * 60 * 1000));

    } else if (mode === 'monthly') {
      currentStart.setDate(1);
      currentStart.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(currentStart);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      if (now >= currentStart && now <= endOfMonth) {
        currentEnd.setTime(now.getTime());
      } else {
        currentEnd.setTime(endOfMonth.getTime());
      }

      previousStart.setMonth(previousStart.getMonth() - 1);

      const isPartial = currentEnd < endOfMonth;
      if (isPartial) {
        previousEnd.setTime(previousStart.getTime());
        previousEnd.setDate(currentEnd.getDate());
        previousEnd.setHours(currentEnd.getHours(), currentEnd.getMinutes(), currentEnd.getSeconds());
      } else {
        previousEnd.setMonth(previousEnd.getMonth() + 1);
        previousEnd.setDate(0);
        previousEnd.setHours(23, 59, 59, 999);
      }
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  };

  const fetchSalesData = async () => {
    setLoading(true);
    setSelectedGraphBar(null);
    setError(null);

    try {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      // 1. Fetch SMS logs for the selected date in background
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateParam = `${year}-${month}-${day}`;
        const res = await fetch(`/api/admin/sms-logs?date=${dateParam}`);
        const smsData = await res.json();
        if (smsData && smsData.success && smsData.logs) {
          setTodaySmsLogs(smsData.logs);
          
          // Pre-populate SMS cache
          const cache = {};
          smsData.logs.forEach(log => {
            const cleanPhone = log.phone?.trim();
            if (cleanPhone && !cache[cleanPhone]) {
              cache[cleanPhone] = {
                status: log.status,
                error: log.error,
                sentAt: log.sent_at || log.created_at,
                loading: false
              };
            }
          });
          setSmsCache(prev => ({ ...cache, ...prev }));
        }
      } catch (err) {
        console.error('Failed to pre-fetch daily SMS logs:', err);
      }

      // 2. Fetch Orders - Always try direct server/Supabase query first (paginated). Fall back to local Dexie on failure.
      let orders = [];
      const flattened = [];
      const rawOrders = [];

      try {
        console.log(`📡 [SalesDashboard] Fetching directly from server/Supabase: ${start.toISOString()} - ${end.toISOString()}`);
        
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data: pageOrders, error: supabaseErr } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              customer_phone,
              customer_name,
              order_status,
              is_paid,
              paid_amount,
              customer_id,
              created_at,
              completed_at,
              updated_at,
              payment_method,
              total_amount,
              order_type,
              order_origin,
              order_items (
                id,
                quantity,
                price,
                mods,
                notes,
                item_status,
                menu_items (
                  id,
                  name,
                  category,
                  price
                )
              )
            `)
            .eq('business_id', currentUser?.business_id)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (supabaseErr) throw supabaseErr;
          if (!pageOrders || pageOrders.length === 0) break;
          orders.push(...pageOrders);
          if (pageOrders.length < pageSize) break;
          page++;
        }
        
        orders.forEach(order => {
          const itemsWithMenu = [];
          const isOth = order.payment_method === 'oth';
          order.order_items?.forEach(item => {
            const menuItem = item.menu_items;
            flattened.push({
              quantity: item.quantity || 0,
              price: isOth ? 0 : (item.price || menuItem?.price || 0),
              category: menuItem?.category || 'אחר',
              name: menuItem?.name || item.name || 'לא ידוע',
              date: order.created_at
            });
            itemsWithMenu.push({ ...item, menu_items: menuItem });
          });
          
          rawOrders.push({ 
            ...order, 
            total_amount: isOth ? 0 : (order.total_amount || 0),
            order_items: itemsWithMenu 
          });
        });
      } catch (serverErr) {
        console.warn('⚠️ Server query failed, falling back to local Dexie backup...', serverErr);
        
        const localOrders = await db.orders
          .where('created_at')
          .between(start.toISOString(), end.toISOString(), true, true)
          .toArray();

        const businessOrders = localOrders.filter(o => String(o.business_id) === String(currentUser?.business_id));
        
        for (const order of businessOrders) {
          const items = await db.order_items.where('order_id').equals(order.id).toArray();
          const itemsWithMenu = [];
          const isOth = order.payment_method === 'oth';

          for (const item of items) {
            const menuItem = await db.menu_items.get(item.menu_item_id);
            flattened.push({
              quantity: item.quantity || 0,
              price: isOth ? 0 : (item.price || menuItem?.price || 0),
              category: menuItem?.category || 'אחר',
              name: menuItem?.name || item.name || 'לא ידוע',
              date: order.created_at
            });
            itemsWithMenu.push({ ...item, menu_items: menuItem });
          }
          
          rawOrders.push({ 
            ...order, 
            total_amount: isOth ? 0 : (order.total_amount || 0),
            order_items: itemsWithMenu 
          });
        }
      }

      // Check and auto-complete orders
      const cleanedRawOrders = [];
      for (const order of rawOrders) {
        if (order.order_status === 'in_progress') {
          const items = order.order_items || [];
          if (items.length > 0) {
            const hasNonTerminalItems = items.some(i => {
              const menuItem = i.menu_items;
              const isPrep = isKitchenPrep({
                ...i,
                is_hot_drink: menuItem?.is_hot_drink,
                category: menuItem?.category,
                kds_routing_logic: i.kds_routing_logic || menuItem?.kds_routing_logic
              });
              const kdsLogic = menuItem?.kds_routing_logic || 'MADE_TO_ORDER';

              let hasOverride = false;
              const mods = i.mods;
              if (typeof mods === 'string' && (mods.includes('__KDS_OVERRIDE__') || mods.includes('__KDS_OVER_RIDE__'))) hasOverride = true;
              else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVER_REIDE__'))) hasOverride = true;
              else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVERRIDE__'))) hasOverride = true;

              const effectiveLogic = i.kds_routing_logic || kdsLogic;

              let isPrepRequired = true;
              if (hasOverride) isPrepRequired = true;
              else if (isPrep) isPrepRequired = true;
              else if (effectiveLogic === 'MADE_TO_ORDER') isPrepRequired = true;
              else if (effectiveLogic === 'GRAB_AND_GO') isPrepRequired = false;
              else if (effectiveLogic === 'prep_override') isPrepRequired = false;
              else if (effectiveLogic === 'CONDITIONAL') isPrepRequired = hasOverride;

              return isPrepRequired && !['completed', 'shipped', 'cancelled'].includes(i.item_status || i.status || 'new');
            });

            // Calculate paid status
            const allItems = items.filter(i => (i.item_status || i.status) !== 'cancelled');
            const calculatedTotal = allItems.reduce((sum, i) => {
              const menuItem = i.menu_items;
              return sum + (menuItem?.price || 0) * (i.quantity || 1);
            }, 0);

            const totalAmount = order.total_amount || calculatedTotal;
            const paidAmount = order.paid_amount || 0;
            const unpaidAmount = totalAmount - paidAmount;
            const isOrderPaid = order.is_paid === true;
            const isEffectivelyUnpaid = !isOrderPaid && unpaidAmount > 0.01;

            console.log(`🕵️ [SalesDashboard Debug] Order #${order.order_number}:`, {
              hasNonTerminalItems,
              isEffectivelyUnpaid,
              isOrderPaid,
              totalAmount,
              paidAmount,
              unpaidAmount,
              itemsCount: items.length,
              items: items.map(i => ({ name: i.menu_items?.name || i.name, status: i.item_status || i.status, isPrep: isKitchenPrep(i) }))
            });

            if (!hasNonTerminalItems && !isEffectivelyUnpaid) {
              console.log(`🤖 [SalesDashboard Auto-Complete] Auto-completing order #${order.order_number}`);
              // Mutate in-memory for instant UI update
              order.order_status = 'completed';
              
              // Trigger DB updates asynchronously
              supabase
                .from('orders')
                .update({ order_status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', order.id)
                .then(({ error }) => {
                  if (error) console.error('Error auto-completing order on server:', error);
                });

              db.orders.update(order.id, { order_status: 'completed', updated_at: new Date().toISOString() }).catch(() => {});
            }
          }
        }
        cleanedRawOrders.push(order);
      }

      setCurrentSales(flattened);
      setCurrentRawOrders(cleanedRawOrders);

      // Comparison period (previous week same day)
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);
      const prevFlattened = [];

      try {
        let prevOrders = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data: pageOrders, error: prevErr } = await supabase
            .from('orders')
            .select(`
              id,
              created_at,
              payment_method,
              order_items (
                quantity,
                price,
                menu_items (
                  price,
                  category,
                  name
                )
              )
            `)
            .eq('business_id', currentUser?.business_id)
            .gte('created_at', prevStart.toISOString())
            .lte('created_at', prevEnd.toISOString())
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (prevErr) throw prevErr;
          if (!pageOrders || pageOrders.length === 0) break;
          prevOrders.push(...pageOrders);
          if (pageOrders.length < pageSize) break;
          page++;
        }

        prevOrders.forEach(order => {
          const isOth = order.payment_method === 'oth';
          order.order_items?.forEach(item => {
            const menuItem = item.menu_items;
            prevFlattened.push({
              quantity: item.quantity || 0,
              price: isOth ? 0 : (item.price || menuItem?.price || 0),
              category: menuItem?.category || 'אחר',
              name: menuItem?.name || item.name || 'לא ידוע',
              date: order.created_at
            });
          });
        });
      } catch (prevServerErr) {
        console.warn('⚠️ Server comparison query failed, falling back to local Dexie backup...', prevServerErr);
        
        const prevLocalOrders = await db.orders
          .where('created_at')
          .between(prevStart.toISOString(), prevEnd.toISOString(), true, true)
          .toArray();
        const prevBusinessOrders = prevLocalOrders.filter(o => String(o.business_id) === String(currentUser?.business_id));
        
        for (const order of prevBusinessOrders) {
          const items = await db.order_items.where('order_id').equals(order.id).toArray();
          for (const item of items) {
            const menuItem = await db.menu_items.get(item.menu_item_id);
            prevFlattened.push({
              quantity: item.quantity || 0,
              price: item.price || menuItem?.price || 0,
              category: menuItem?.category || 'אחר',
              name: menuItem?.name || item.name || 'לא ידוע',
              date: order.created_at
            });
          }
        }
      }
      setPreviousSales(prevFlattened);

    } catch (err) {
      console.error('Error fetching sales:', err);
      setError('שגיאה בטעינת נתוני מכירות והזמנות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.business_id) {
      fetchSalesData();

      // NEW: Realtime Sync for "Immediate Indicator"
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `business_id=eq.${currentUser.business_id}`
          },
          (payload) => {
            console.log('🔄 Realtime Order Update detected:', payload);
            fetchSalesData(); // Trigger full refresh to update graphs and lists
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_items',
            filter: `business_id=eq.${currentUser.business_id}`
          },
          () => {
            fetchSalesData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [viewMode, selectedDate, currentUser?.business_id]);

  // Aggregation Helpers
  const aggregate = (data) => {
    const total = data.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deepStats = data.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { totalAmount: 0, totalCount: 0, items: {} };
      }
      acc[item.category].totalAmount += (item.price * item.quantity);
      acc[item.category].totalCount += item.quantity;
      if (!acc[item.category].items[item.name]) {
        acc[item.category].items[item.name] = { count: 0, total: 0 };
      }
      acc[item.category].items[item.name].count += item.quantity;
      acc[item.category].items[item.name].total += (item.price * item.quantity);
      return acc;
    }, {});
    return { total, deepStats };
  };

  // Filtered Sales Logic (Interactive Graph)
  const isExcluded = (dateStr) => {
    if (!selectedGraphBar) return false;
    const d = new Date(dateStr);
    if (viewMode === 'daily') {
      return d.getHours() !== selectedGraphBar.key;
    } else {
      // Compare D/M key
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      return key !== selectedGraphBar.key;
    }
  };

  const displayedSales = useMemo(() => {
    if (!selectedGraphBar) return currentSales;
    return currentSales.filter(item => !isExcluded(item.date));
  }, [currentSales, selectedGraphBar, viewMode]);

  const displayedOrders = useMemo(() => {
    if (!selectedGraphBar) return currentRawOrders;
    return currentRawOrders.filter(order => !isExcluded(order.created_at));
  }, [currentRawOrders, selectedGraphBar, viewMode]);

  const currentStats = useMemo(() => aggregate(displayedSales), [displayedSales]);
  const totalPeriodStats = useMemo(() => aggregate(currentSales), [currentSales]);
  const previousStats = useMemo(() => aggregate(previousSales), [previousSales]);

  // Calculate Percentage Change
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const percentageChange = useMemo(() => {
    return calculateChange(totalPeriodStats.total, previousStats.total);
  }, [totalPeriodStats, previousStats]);

  /**
   * SPLIT STATS - "Apples to Apples" Comparison Logic
   * 
   * Business Problem: When comparing weekly/monthly sales, a simple comparison
   * is unfair. Example: It's Wednesday noon, and we compare to last full week.
   * Last week had 7 days, this week has only 2.5 days = misleading comparison!
   * 
   * Solution: We calculate TWO metrics:
   * 1. PARTIAL (Cumulative): Sales up to the same day/hour as "now"
   *    - If today is Wed 12:00, we compare:
   *      This week: Sun-Wed 12:00 vs Last week: Sun-Wed 12:00
   *    - This gives a FAIR "apples to apples" comparison.
   * 
   * 2. FULL: Total sales for the entire period.
   *    - For current period: Shows "in progress" indicator.
   *    - For past periods: Shows final total.
   * 
   * The "offset" calculation converts a date to "minutes since period start"
   * to enable comparing the same relative point in different periods.
   */
  const splitStats = useMemo(() => {
    if (viewMode !== 'weekly' && viewMode !== 'monthly') return null;

    const now = new Date();

    if (viewMode === 'weekly') {
      // Calculate offset in minutes from Sunday 00:00 (start of week)
      // Formula: (dayOfWeek * 24 * 60) + (hours * 60) + minutes
      const getWeekOffset = (d) => {
        const date = new Date(d);
        return (date.getDay() * 24 * 60) + (date.getHours() * 60) + date.getMinutes();
      };
      const currentOffset = getWeekOffset(now);
      // Filter items that occurred before "now" relative to their week start
      const isPartial = (item) => getWeekOffset(item.date) <= currentOffset;

      const partialCurrent = currentSales.filter(isPartial);
      const partialPrevious = previousSales.filter(isPartial);

      return {
        partial: {
          total: aggregate(partialCurrent).total,
          prev: aggregate(partialPrevious).total,
          change: calculateChange(aggregate(partialCurrent).total, aggregate(partialPrevious).total)
        },
        full: {
          total: totalPeriodStats.total,
          prev: previousStats.total,
          change: calculateChange(totalPeriodStats.total, previousStats.total)
        }
      };
    } else {
      // Monthly: Calculate offset in minutes from 1st of month 00:00
      // Formula: (dayOfMonth * 24 * 60) + (hours * 60) + minutes
      const getMonthOffset = (d) => {
        const date = new Date(d);
        return (date.getDate() * 24 * 60) + (date.getHours() * 60) + date.getMinutes();
      };
      const currentOffset = getMonthOffset(now);
      const isPartial = (item) => getMonthOffset(item.date) <= currentOffset;

      const partialCurrent = currentSales.filter(isPartial);
      const partialPrevious = previousSales.filter(isPartial);

      return {
        partial: {
          total: aggregate(partialCurrent).total,
          prev: aggregate(partialPrevious).total,
          change: calculateChange(aggregate(partialCurrent).total, aggregate(partialPrevious).total)
        },
        full: {
          total: totalPeriodStats.total,
          prev: previousStats.total,
          change: calculateChange(totalPeriodStats.total, previousStats.total)
        }
      };
    }
  }, [viewMode, currentSales, previousSales, totalPeriodStats, previousStats]);

  // Hourly metrics (Orders count & Prep times)
  const hourlyMetrics = useMemo(() => {
    const hoursMap = new Map(); // hour -> { orderCount: 0, totalPrepTime: 0, completedCount: 0 }
    
    currentRawOrders.forEach(order => {
      const date = new Date(order.created_at);
      const h = date.getHours();
      
      if (!hoursMap.has(h)) {
        hoursMap.set(h, { orderCount: 0, totalPrepTime: 0, completedCount: 0 });
      }
      
      const metrics = hoursMap.get(h);
      metrics.orderCount += 1;
      
      const compTime = order.completed_at || (order.order_status === 'completed' ? order.updated_at : null);
      if (compTime) {
        const diffMs = new Date(compTime) - new Date(order.created_at);
        const diffMins = Math.round(diffMs / 1000 / 60);
        if (diffMins >= 0 && diffMins < 180) {
          metrics.totalPrepTime += diffMins;
          metrics.completedCount += 1;
        }
      }
    });

    let minHour = 23;
    let maxHour = 0;
    for (let h of hoursMap.keys()) {
      if (h < minHour) minHour = h;
      if (h > maxHour) maxHour = h;
    }
    
    if (hoursMap.size === 0) {
      minHour = 8;
      maxHour = 20;
    } else {
      minHour = Math.max(0, minHour - 1);
      maxHour = Math.min(23, maxHour + 1);
    }

    const result = [];
    for (let i = minHour; i <= maxHour; i++) {
      const metrics = hoursMap.get(i) || { orderCount: 0, totalPrepTime: 0, completedCount: 0 };
      const avgPrep = metrics.completedCount > 0 ? Math.round(metrics.totalPrepTime / metrics.completedCount) : 0;
      result.push({
        name: `${i}:00`,
        key: i,
        orderCount: metrics.orderCount,
        avgPrepTime: avgPrep
      });
    }
    return result;
  }, [currentRawOrders]);

  // Graph Data Preparation
  const graphData = useMemo(() => {
    if (viewMode === 'daily') {
      const hoursMap = new Map();
      currentSales.forEach(item => {
        const h = new Date(item.date).getHours();
        const currentVal = hoursMap.get(h) || 0;
        hoursMap.set(h, currentVal + (item.price * item.quantity));
      });

      if (hoursMap.size === 0) return [];

      let minHour = 23;
      let maxHour = 0;
      for (let h of hoursMap.keys()) {
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
      minHour = Math.max(0, minHour - 1);
      maxHour = Math.min(23, maxHour + 1);

      const result = [];
      for (let i = minHour; i <= maxHour; i++) {
        result.push({
          name: `${i}:00`,
          key: i,
          amount: hoursMap.get(i) || 0
        });
      }
      return result;

    } else {
      // Weekly/Monthly: Show all days in the range
      const buckets = {};

      // Create buckets for data
      currentSales.forEach(item => {
        const d = new Date(item.date);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (!buckets[key]) buckets[key] = 0;
        buckets[key] += (item.price * item.quantity);
      });

      const result = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      let rangeStart, rangeEnd;

      if (viewMode === 'weekly') {
        rangeStart = new Date(selectedDate);
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
        rangeStart.setHours(0, 0, 0, 0);

        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 6);
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        // Monthly logic
        rangeStart = new Date(selectedDate);
        rangeStart.setDate(1);
        rangeStart.setHours(0, 0, 0, 0);

        rangeEnd = new Date(rangeStart);
        rangeEnd.setMonth(rangeEnd.getMonth() + 1);
        rangeEnd.setDate(0); // Last day of the month
        rangeEnd.setHours(23, 59, 59, 999);

        // If the selected month is the current month, limit end date to 'now'
        if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
          rangeEnd = new Date(now);
        }
      }

      let currentDay = new Date(rangeStart);

      while (currentDay <= rangeEnd) {
        const key = `${currentDay.getDate()}/${currentDay.getMonth() + 1}`;
        const displayName = viewMode === 'monthly' ? `${currentDay.getDate()}` : key;
        result.push({
          name: displayName,
          key: key,
          amount: buckets[key] || 0
        });
        currentDay = new Date(currentDay.getTime() + dayMs);
      }

      return result;
    }
  }, [currentSales, viewMode, selectedDate]);

  // Navigation (Unchanged Logic - Copied for context)
  const goToPreviousPeriod = () => {
    let nextDate = new Date(selectedDate);
    if (viewMode === 'daily' && activeDates.length > 0) {
      const currentStr = selectedDate.toDateString();
      const currentIndex = activeDates.indexOf(currentStr);
      if (currentIndex < activeDates.length - 1 && currentIndex !== -1) nextDate = new Date(activeDates[currentIndex + 1]);
      else if (currentIndex === -1) {
        const targetIndex = activeDates.findIndex(d => new Date(d) < selectedDate);
        if (targetIndex !== -1) nextDate = new Date(activeDates[targetIndex]);
        else nextDate.setDate(nextDate.getDate() - 1);
      } else nextDate.setDate(nextDate.getDate() - 1);
    } else {
      if (viewMode === 'daily') nextDate.setDate(nextDate.getDate() - 1);
      else if (viewMode === 'weekly') nextDate.setDate(nextDate.getDate() - 7);
      else if (viewMode === 'monthly') nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setDateTuple([nextDate.getTime(), -1]);
  };

  const goToNextPeriod = () => {
    let nextDate = new Date(selectedDate);
    if (viewMode === 'daily' && activeDates.length > 0) {
      const currentStr = selectedDate.toDateString();
      const currentIndex = activeDates.indexOf(currentStr);
      if (currentIndex > 0) nextDate = new Date(activeDates[currentIndex - 1]);
      else if (currentIndex === -1) {
        const reversed = [...activeDates].reverse();
        const target = reversed.find(d => new Date(d) > selectedDate);
        if (target) nextDate = new Date(target);
        else nextDate.setDate(nextDate.getDate() + 1);
      } else nextDate.setDate(nextDate.getDate() + 1);
    } else {
      if (viewMode === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      else if (viewMode === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (viewMode === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    }
    if (nextDate <= new Date() || (viewMode === 'monthly' && nextDate.getMonth() === new Date().getMonth() && nextDate.getFullYear() === new Date().getFullYear()) || (viewMode === 'weekly' && nextDate.getTime() <= new Date().getTime() + 7 * 24 * 60 * 60 * 1000)) {
      setDateTuple([nextDate.getTime(), 1]);
    }
  };

  const isNextDisabled = () => {
    const now = new Date();
    if (viewMode === 'daily') return selectedDate.toDateString() === now.toDateString();
    if (viewMode === 'weekly') {
      const startOfCurrentWeek = new Date(now);
      startOfCurrentWeek.setDate(now.getDate() - now.getDay());
      return selectedDate >= startOfCurrentWeek;
    }
    if (viewMode === 'monthly') return selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    return false;
  };

  const getPeriodLabel = () => {
    const date = selectedDate;
    if (viewMode === 'daily') return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    return date.toLocaleDateString('he-IL');
  };

  const getComparisonLabel = () => {
    if (viewMode === 'daily') {
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      return `מול יום ${days[selectedDate.getDay()]} שעבר`;
    }
    return 'מול תקופה קודמת';
  }

  // Helper: Get descriptive label for partial comparison
  const getPartialLabel = () => {
    const now = new Date();
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (viewMode === 'weekly') {
      if (isNextDisabled()) {
        return `עד היום בשעה ${timeStr}`;
      } else {
        return `עד יום ${days[now.getDay()]} ${timeStr}`;
      }
    } else if (viewMode === 'monthly') {
      if (isNextDisabled()) {
        return `עד ה-${now.getDate()} בשעה ${timeStr}`;
      } else {
        return `עד ה-${now.getDate()} בחודש`;
      }
    }
    return '';
  };

  // Helper: Get period date range label
  const getPeriodRangeLabel = () => {
    const formatDate = (date) => `${date.getDate()}/${date.getMonth() + 1}`;
    const d = new Date(selectedDate);

    if (viewMode === 'weekly') {
      if (isNextDisabled()) return 'השבוע הנוכחי';
      const start = new Date(d); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 6);

      // Check if it's last week
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const startOfLastWeek = new Date(oneWeekAgo); startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay()); startOfLastWeek.setHours(0, 0, 0, 0);
      if (start.getTime() === startOfLastWeek.getTime()) {
        return `שבוע שעבר (${formatDate(start)} - ${formatDate(end)})`;
      }
      return `${formatDate(start)} - ${formatDate(end)}`;
    } else if (viewMode === 'monthly') {
      if (isNextDisabled()) return selectedDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      // Check if it's last month
      const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
      if (d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()) {
        return `חודש שעבר (${d.toLocaleDateString('he-IL', { month: 'long' })})`;
      }
      return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? -500 : 500, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction) => ({ zIndex: 0, x: direction < 0 ? -500 : 500, opacity: 0 })
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const getCleanMods = (mods) => {
    if (!mods) return [];
    return mods.filter(m => {
      const name = typeof m === 'string' ? m : (m.name || m.value_name || '');
      return name && !name.includes('__KDS_OVERRIDE__');
    });
  };

  const renderSmsStatusIcon = (smsInfo) => {
    if (!smsInfo) return <span className="text-slate-400">💬</span>;
    if (smsInfo.loading) return <span className="text-blue-500 animate-pulse">🔄</span>;
    if (smsInfo.status === 'success' || smsInfo.status === 'sent') return <span className="text-emerald-600 font-bold">✅</span>;
    if (smsInfo.status === 'offline') return <span className="text-yellow-600">🔌</span>;
    if (smsInfo.status === 'failed') return <span className="text-red-500">❌</span>;
    if (smsInfo.status === 'pending_order') return <span className="text-slate-400">⏳</span>;
    return <span className="text-slate-400">💬</span>;
  };

  const getSmsTooltip = (smsInfo) => {
    if (!smsInfo) return 'לא נשלחה הודעה';
    if (smsInfo.loading) return 'טוען סטטוס...';
    if (smsInfo.status === 'success' || smsInfo.status === 'sent') {
      const time = smsInfo.sentAt ? new Date(smsInfo.sentAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
      return `נשלח בהצלחה${time ? ` ב-${time}` : ''}`;
    }
    if (smsInfo.status === 'offline') return 'אופליין - ההודעה ממתינה ברשת המקומית';
    if (smsInfo.status === 'failed') return `נכשל: ${smsInfo.error || 'שגיאת ספק'}`;
    if (smsInfo.status === 'pending_order') return 'ממתין לסיום ההזמנה';
    return 'לא נשלחה הודעה';
  };

  const renderOrderCard = (order) => {
    const isExpanded = expandedOrderIds.has(order.id);
    const timeStr = new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const orderNum = order.order_number || (order.id?.toString() || '').slice(-4) || 'N/A';
    const status = order.order_status || order.orderStatus || 'completed';
    
    // Get SMS cache info
    const cleanPhone = order.customer_phone?.trim();
    const smsInfo = cleanPhone ? smsCache[cleanPhone] : null;

    return (
      <div
        key={order.id}
        className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-gray-300"
      >
        <div
          onClick={() => toggleOrder(order.id)}
          className={`p-3 flex items-center justify-between cursor-pointer gap-4 ${isExpanded ? 'bg-blue-50/50' : 'bg-white'}`}
        >
          {/* Right Column: Time, Customer Name, Inline Phone/SMS, Prep Time */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center w-12 h-10 bg-gray-100 rounded-lg text-gray-600 shrink-0">
              <Clock size={12} className="mb-0.5 opacity-70" />
              <span className="font-bold font-mono text-xs">{timeStr}</span>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-gray-900 text-base">
                  {order.customer_name || order.customerName || 'לקוח מזדמן'}
                </span>
                {order.order_origin && (
                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-500">
                    {order.order_origin}
                  </span>
                )}
                <span className="text-[10px] text-gray-450 font-bold font-mono">#{orderNum}</span>
                
                {/* Inline Phone and SMS Badge */}
                {cleanPhone && !cleanPhone.startsWith('GUEST_') ? (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    <span className="text-gray-600 font-mono">{cleanPhone.replace('972', '0')}</span>
                    {status !== 'in_progress' && (
                      <span title={getSmsTooltip(smsInfo)} className="cursor-help flex items-center">
                        {renderSmsStatusIcon(smsInfo)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-400">
                    👤 ללא טלפון
                  </span>
                )}
              </div>

              {/* Preparation duration badge */}
              {(() => {
                const compTime = order.completed_at || (status === 'completed' ? order.updated_at : null);
                if (compTime) {
                  const diffMs = new Date(compTime) - new Date(order.created_at);
                  const diffMins = Math.round(diffMs / 1000 / 60);
                  if (diffMins >= 0 && diffMins < 180) {
                    return (
                      <div className="mt-0.5">
                        <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-black text-indigo-600 inline-flex items-center gap-0.5">
                          <span>⏱️ {diffMins} דק׳ הכנה</span>
                        </span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>
          </div>

          {/* Left Column: Totals, Payment Method, and Chevron */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {order.payment_method && (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black">
                  {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                </span>
              )}
              <span className="font-black text-slate-900 text-base">{formatCurrency(order.total_amount || 0)}</span>
            </div>

            {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden bg-gray-50 border-t border-gray-100"
            >
              <div className="p-4 space-y-4">
                
                {/* Order Details Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3 text-right">פריט</th>
                        <th className="py-2 px-3 text-center">כמות</th>
                        <th className="py-2 px-3 text-left">מחיר</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {order.order_items.map((item, idx) => {
                        const itemMods = getCleanMods(item.mods || item.modifiers);
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800 text-sm">
                                  {item.menu_items?.name || 'פריט לא ידוע'}
                                </span>
                                {/* Modifiers List - Badges Wrap */}
                                {itemMods.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5 max-w-lg">
                                    {itemMods.map((mod, mIdx) => (
                                      <span key={mIdx} className="text-[9px] font-black bg-amber-100/70 border border-amber-200/50 text-amber-800 px-2 py-0.5 rounded-full select-none">
                                        {typeof mod === 'string' ? mod : (mod.name || mod.value_name || '')}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {item.notes && (
                                  <span className="text-[10px] text-orange-600 mt-1 font-bold">
                                    📝 הערה: {item.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                              {item.quantity}x
                            </td>
                            <td className="py-3 px-3 text-left font-medium text-gray-900">
                              {formatCurrency((item.price || item.menu_items?.price || 0) * item.quantity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* SMS Notification Log Detail */}
                {cleanPhone && (
                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mr-1">סטטוס מסרון ללקוח:</span>
                    
                    {(() => {
                      if (!smsInfo) {
                        return (
                          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 text-gray-400 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-base animate-pulse">⏳</span>
                              <span className="text-xs font-bold">טוען סטטוס מסרון...</span>
                            </div>
                          </div>
                        );
                      }
                      
                      if (smsInfo.loading) {
                        return (
                          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 text-gray-400 rounded-xl">
                            <div className="flex items-center gap-2">
                              <RefreshCcw size={14} className="animate-spin text-gray-500" />
                              <span className="text-xs font-bold">מתעדכן מול השרת...</span>
                            </div>
                          </div>
                        );
                      }

                      if (smsInfo.status === 'guest') {
                        return (
                          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                            <span className="text-base">⚠️</span>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">אורח אנונימי (הזמנה מקיוסק/טאבלט)</span>
                              <span className="text-[10px] opacity-85">הלקוח לא הזין מספר טלפון, לכן לא נשלח מסרון.</span>
                            </div>
                          </div>
                        );
                      }

                      if (smsInfo.status === 'success' || smsInfo.status === 'sent') {
                        const time = smsInfo.sentAt ? new Date(smsInfo.sentAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'היום';
                        return (
                          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-base">✅</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">מסרון נשלח בהצלחה!</span>
                                <span className="text-[10px] opacity-85">נשלח בהצלחה בשעה {time} למספר {cleanPhone}</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); fetchSmsStatus(cleanPhone, status, true); }}
                              className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-800 transition-all cursor-pointer"
                              title="רענן"
                            >
                              <RefreshCcw size={12} />
                            </button>
                          </div>
                        );
                      }

                      if (smsInfo.status === 'offline') {
                        return (
                          <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🔌</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">מצב אופליין (צומת מקומי ללא אינטרנט)</span>
                                <span className="text-[10px] opacity-85">אין חיבור רשת חיצוני בסניף. ההודעה ממתינה ותישלח אוטומטית ברגע שהאינטרנט יחזור.</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); fetchSmsStatus(cleanPhone, status, true); }}
                              className="p-1.5 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-yellow-800 transition-all cursor-pointer"
                              title="רענן"
                            >
                              <RefreshCcw size={12} />
                            </button>
                          </div>
                        );
                      }

                      if (smsInfo.status === 'failed') {
                        return (
                          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-base">❌</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">שגיאה בשליחת מסרון</span>
                                <span className="text-[10px] opacity-85">השליחה נכשלה. סיבה: {smsInfo.error || 'שגיאת ספק'}</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); fetchSmsStatus(cleanPhone, status, true); }}
                              className="p-1.5 bg-red-100 hover:bg-red-200 rounded-lg text-red-800 transition-all cursor-pointer"
                              title="נסה שוב"
                            >
                              <RefreshCcw size={12} />
                            </button>
                          </div>
                        );
                      }

                      if (smsInfo.status === 'pending_order') {
                        return (
                          <div className="flex items-center justify-between p-3 bg-gray-100 border border-gray-200 text-gray-600 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-base">⏳</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">ההזמנה עדיין בהכנה</span>
                                <span className="text-[10px] opacity-85">מסרון מוכנות יישלח אוטומטית ברגע שההזמנה תסומן כהושלמה במטבח.</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); fetchSmsStatus(cleanPhone, status, true); }}
                              className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-600 transition-all cursor-pointer"
                              title="רענן"
                            >
                              <RefreshCcw size={12} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 text-gray-500 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-base">💬</span>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">לא נשלחה הודעה</span>
                              <span className="text-[10px] opacity-85">לא נמצאו לוגים של מסרונים למספר {cleanPhone} עבור הזמנה זו.</span>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); fetchSmsStatus(cleanPhone, status, true); }}
                            className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-500 transition-all cursor-pointer"
                            title="רענן"
                          >
                            <RefreshCcw size={12} />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Call customer action */}
                {cleanPhone && !cleanPhone.startsWith('GUEST_') && (
                  <div className="flex justify-start pt-1">
                    <a
                      href={`tel:${cleanPhone}`}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors active:scale-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={14} />
                      התקשר ללקוח ({cleanPhone})
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const sortedOrders = [...currentRawOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const activeOrders = sortedOrders.filter(o => {
    const s = o.order_status || o.orderStatus || 'completed';
    return s === 'in_progress';
  });
  const readyOrders = sortedOrders.filter(o => {
    const s = o.order_status || o.orderStatus || 'completed';
    return s === 'ready';
  });
  const completedOrders = sortedOrders.filter(o => {
    const s = o.order_status || o.orderStatus || 'completed';
    return s === 'completed';
  });
  const activeOrdersCount = activeOrders.length + readyOrders.length;
  const completedOrdersCount = completedOrders.length;
  const smsSentCount = todaySmsLogs.filter(log => log.status === 'success' || log.status === 'sent').length;

  return (
    <div className="space-y-4 pb-20 p-4 font-heebo" dir="rtl">
      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Daily Turnover Card with Day Navigation */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl shadow-lg p-5 flex flex-col justify-between h-44 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          
          <div className="flex justify-between items-center relative z-10">
            <span className="text-xs font-black uppercase tracking-wider text-blue-200">מחזור המכירות של היום</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">יומי</span>
          </div>

          <div className="flex items-center justify-between my-2 relative z-10">
            <button
              onClick={goToPreviousPeriod}
              aria-label="יום קודם"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90"
            >
              <ChevronRight size={20} />
            </button>

            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black tracking-tight">{formatCurrency(totalPeriodStats.total)}</div>
              <div className="text-xs text-blue-100 font-bold mt-1">{getPeriodLabel()}</div>
            </div>

            <button
              onClick={goToNextPeriod}
              disabled={isNextDisabled()}
              aria-label="יום הבא"
              className={`p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90 ${isNextDisabled() ? 'opacity-20 pointer-events-none' : ''}`}
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="text-center text-[10px] text-blue-200/70 border-t border-white/10 pt-2 relative z-10">
            השוואה ליום מקביל שבוע שעבר: {formatCurrency(previousStats.total)} ({percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%)
          </div>
        </div>

        {/* Orders & SMS Summary Metrics Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-44">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">נתוני הזמנות ומסרונים</span>
          
          <div className="grid grid-cols-3 gap-2 text-center py-2">
            <div className="flex flex-col items-center border-l border-slate-100 last:border-0">
              <span className="text-3xl font-black text-amber-500">{activeOrdersCount}</span>
              <span className="text-[10px] text-slate-500 font-black mt-1">על הפס</span>
            </div>
            <div className="flex flex-col items-center border-l border-slate-100 last:border-0">
              <span className="text-3xl font-black text-emerald-500">{completedOrdersCount}</span>
              <span className="text-[10px] text-slate-500 font-black mt-1">הושלמו</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-cyan-500">{smsSentCount}</span>
              <span className="text-[10px] text-slate-500 font-black mt-1">נשלחו SMS</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center border-t border-slate-50 pt-2 font-bold">
            נכון ליום {getPeriodLabel()}
          </div>
        </div>

      </div>

      {/* Hourly Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart 1: Sales by Hour */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <h3 className="font-bold text-gray-800 mb-1 text-sm px-2 flex justify-between items-center h-6">
            <span>מכירות לפי שעות</span>
            <BarChart3 size={16} className="text-blue-500" />
          </h3>
          <div className="flex-1 w-full min-h-0 text-xs mt-1">
            {graphData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center border border-dashed border-gray-100 rounded-lg">אין נתונים להצגה</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => `₪${val}`}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#60a5fa"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Average Prep Time by Hour */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <h3 className="font-bold text-gray-800 mb-1 text-sm px-2 flex justify-between items-center h-6">
            <span>זמני הכנה ממוצעים לפי שעות</span>
            <Clock size={16} className="text-amber-500" />
          </h3>
          <div className="flex-1 w-full min-h-0 text-xs mt-1">
            {hourlyMetrics.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center border border-dashed border-gray-100 rounded-lg">אין נתונים להצגה</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyMetrics} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => `${val} דק׳`}
                  />
                  <Bar
                    dataKey="avgPrepTime"
                    fill="#f59e0b"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex justify-center gap-2 pt-2 pb-1">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-lg border border-slate-200/50 shadow-inner">
          {[
            { id: 'in_progress', label: 'בהכנה', count: activeOrders.length, color: 'text-amber-600', activeBg: 'bg-amber-500 text-white shadow-sm font-black' },
            { id: 'ready', label: 'מוכנות', count: readyOrders.length, color: 'text-green-600', activeBg: 'bg-green-600 text-white shadow-sm font-black' },
            { id: 'completed', label: 'הושלמו', count: completedOrders.length, color: 'text-slate-650', activeBg: 'bg-slate-600 text-white shadow-sm font-black' }
          ].map(pill => {
            const isActive = selectedStatusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setSelectedStatusFilter(pill.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isActive ? pill.activeBg : `${pill.color} hover:bg-white/50`
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200/60 text-slate-700'}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Orders List */}
      <div className="space-y-3 pt-3">
        {(() => {
          const filteredOrders = 
            selectedStatusFilter === 'in_progress' ? activeOrders :
            selectedStatusFilter === 'ready' ? readyOrders :
            completedOrders;

          const labelStr = 
            selectedStatusFilter === 'in_progress' ? 'בהכנה' :
            selectedStatusFilter === 'ready' ? 'מוכנות' :
            'שהושלמו';

          if (filteredOrders.length === 0) {
            return (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl text-sm bg-white/50">
                אין הזמנות {labelStr} כעת
              </div>
            );
          }

          return filteredOrders.map(order => renderOrderCard(order));
        })()}
      </div>
    </div>
  );
};

export default SalesDashboard;
