import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Package, Plus, RotateCcw,
  Clock, CreditCard, ChefHat, CheckCircle, List,
  Check, AlertTriangle, X, RefreshCw, Flame, Edit, ChevronRight, House, ChevronDown,
  Calendar, ChevronLeft, History, Database
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sendSms } from '@/services/smsService';
import KDSPaymentModal from '@/pages/kds/components/KDSPaymentModal';
import HistoryInfoModal from '@/pages/kds/components/HistoryInfoModal';
import StaffQuickAccessModal from '@/components/StaffQuickAccessModal';
import { useAuth } from '@/context/AuthContext';
import { isDrink, isHotDrink, sortItems, groupOrderItems } from '@/utils/kdsUtils';
import OrderCard from '@/pages/kds/components/OrderCard';
import OrderEditModal from '@/pages/kds/components/OrderEditModal';
import DateScroller from '@/pages/kds/components/DateScroller';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import BusinessInfoBar from '@/components/BusinessInfoBar';
import { useKDSDataLocal as useKDSData } from '@/pages/kds/hooks/useKDSDataLocal';
import { getBackendApiUrl } from '@/utils/apiUtils';

// Simple Error Boundary for KDS
class KDSErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('KDS Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4 font-heebo">
          <div className="bg-slate-50 w-full max-w-md rounded-[24px] overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <h2 className="text-2xl font-black text-slate-800 mb-2">שגיאה במסך מטבח</h2>
            <p className="text-slate-600 mb-6">אירעה שגיאה בלתי צפויה. אנא רענן את הדף.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
            >
              רענן דף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



// --- סגנונות (CSS) ---
const kdsStyles = `
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');

  .font-heebo { font-family: 'Heebo', sans-serif; }

  .kds-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
  .kds-card:active {
  transform: scale(0.99);
}

  /* שם הפריט - קומפקטי יותר */
  .item-text {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

  .animate-strong-pulse { border-color: #000; }

  /* New Scroll Controls - Compact & Prominent */
  .scroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 30;
    width: 40px;
    height: 50px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(8px);
    border: 2px solid rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border-radius: 10px;
  }
  
  .scroll-btn:hover {
    background: white;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
    border-color: #3b82f6;
  }
  
  .scroll-btn:active {
    transform: translateY(-50%) scale(0.95);
  }
  
  .scroll-btn-right { right: 6px; }
  .scroll-btn-left { left: 6px; }
  .scroll-btn:disabled { opacity: 0; pointer-events: none; }
  
  .scroll-count {
    font-size: 13px;
    font-weight: 900;
    color: white;
    background: #3b82f6;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
    margin-bottom: 2px;
  }
  
  .scroll-arrows {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  /* Linear Progress Loader */
  .kds-loader-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: #e2e8f0;
    overflow: hidden;
    z-index: 50;
    border-radius: 4px 4px 0 0;
  }
  .kds-loader-progress {
    width: 30%;
    height: 100%;
    background: #3b82f6;
    animation: kds-loading 1.5s infinite ease-in-out;
  }
  @keyframes kds-loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }

  /* 🕒 Aging Order States - Minimalist Black Design */
  .aging-warn {
    border: 3px solid #000 !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .aging-critical {
    border: 4px solid #000 !important;
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.25);
    animation: aging-pulse-black 1.5s infinite ease-in-out;
  }
  @keyframes aging-pulse-black {
    0%, 100% { transform: scale(1); border-width: 4px; }
    50% { transform: scale(1.02); border-width: 6px; }
  }
  .scroll-btn-pulse {
    animation: btn-pulse 1.2s ease-in-out infinite;
    border-color: #3b82f6;
  }
  
  .scroll-btn-flash {
    animation: btn-flash 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  @keyframes btn-pulse {
    0%, 100% { 
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      transform: translateY(-50%) scale(1);
    }
    50% { 
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25), 0 4px 10px rgba(0, 0, 0, 0.1);
      transform: translateY(-50%) scale(1.05);
    }
  }

  @keyframes btn-flash {
    0%, 50%, 100% { background: white; border-color: rgba(0, 0, 0, 0.15); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); }
    25%, 75% { background: #dbeafe; border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
  }

  .new-order-glow {
    border-radius: 12px;
    animation: glow-fade 3s forwards;
  }
  
  /* Orange glow for cards moving to "בטיפול" (active/in_progress) */
  .glow-active {
    border-radius: 12px;
    animation: glow-fade-orange 3s forwards;
  }
  
  /* Green glow for cards moving to "מוכן" (ready) */
  .glow-ready {
    border-radius: 12px;
    animation: glow-fade-green 3s forwards;
  }
  
  @keyframes glow-fade-orange {
    0% { box-shadow: 0 0 20px 8px rgba(251, 146, 60, 0.7); }
    100% { box-shadow: none; }
  }
  
  @keyframes glow-fade-green {
    0% { box-shadow: 0 0 20px 8px rgba(34, 197, 94, 0.7); }
    100% { box-shadow: none; }
  }
  
  @keyframes glow-fade {
    0% { box-shadow: 0 0 20px 8px rgba(59, 130, 246, 0.6); }
    100% { box-shadow: none; }
  }
`;

const KDSScrollContainer = ({
  children,
  title,
  orders = [],
  colorClass,
  badgeClass
}) => {
  const scrollRef = useRef(null);
  const [counts, setCounts] = useState({ left: 0, right: 0 });
  const [shouldPulseRight, setShouldPulseRight] = useState(false);
  const [shouldFlashLeft, setShouldFlashLeft] = useState(false);
  const pulseTimerRef = useRef(null);
  const prevLeftCountRef = useRef(0);

  const calculateCounts = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const items = container.querySelectorAll('.kds-card-item');

    let leftCount = 0;
    let rightCount = 0;

    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      // Safety margin of 10px
      if (rect.right < containerRect.left + 5) {
        leftCount++;
      } else if (rect.left > containerRect.right - 5) {
        rightCount++;
      }
    });

    // Trigger flash if left count increased
    if (leftCount > prevLeftCountRef.current) {
      setShouldFlashLeft(true);
      setTimeout(() => setShouldFlashLeft(false), 800);
    }
    prevLeftCountRef.current = leftCount;

    setCounts({ left: leftCount, right: rightCount });

    // Start pulse timer if there are items to the right (need to go back to start in RTL)
    // Only start if not already pulsing and no existing timer
    if (rightCount > 0 && !pulseTimerRef.current) {
      pulseTimerRef.current = setTimeout(() => {
        setShouldPulseRight(true);
        pulseTimerRef.current = null; // Clear ref but keep pulsing
      }, 3000);
    } else if (rightCount === 0) {
      // Back to start - stop pulsing and clear timer
      setShouldPulseRight(false);
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      calculateCounts();
      // Tech Fix: Clear pulse timer if user is manually scrolling
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
    container.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(calculateCounts);
    resizeObserver.observe(container);

    setTimeout(calculateCounts, 200);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [calculateCounts, orders.length]);

  const scrollToEdge = (edge) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;

    // TECH NOTE (RTL Behavior): 
    // In LTR: 0 is left, scrollWidth-clientWidth is right.
    // In RTL: 0 is right (start), -(scrollWidth-clientWidth) is left (end).
    // container.scrollTo handles these directions automatically when dir="rtl" is set.
    const target = edge === 'right' ? 0 : -(container.scrollWidth - container.clientWidth);

    container.scrollTo({
      left: target,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`w-full h-full relative flex flex-col min-h-0 overflow-hidden ${colorClass}`}>
      <div className={`absolute top-3 right-4 z-20 ${badgeClass} px-3 py-1 rounded-full text-xs font-bold shadow-sm`}>
        {title} ({orders.length})
      </div>

      {/* Back to start button (right in RTL) - pulses after 3 seconds */}
      <button
        onClick={() => scrollToEdge('right')}
        disabled={counts.right === 0}
        className={`scroll-btn scroll-btn-right group ${shouldPulseRight ? 'scroll-btn-pulse' : ''}`}
      >
        {counts.right > 0 && <span className="scroll-count">{counts.right}</span>}
        <div className="scroll-arrows flex items-center justify-center -space-x-1.5 rtl:space-x-reverse">
          <ChevronRight size={11} strokeWidth={2.5} className="text-blue-500/70" />
          <ChevronRight size={11} strokeWidth={2.5} className="text-blue-500/70" />
        </div>
      </button>

      {/* Scroll to end button (left in RTL) */}
      <button
        onClick={() => scrollToEdge('left')}
        disabled={counts.left === 0}
        className={`scroll-btn scroll-btn-left group ${shouldFlashLeft ? 'scroll-btn-flash' : ''}`}
      >
        {counts.left > 0 && <span className="scroll-count">{counts.left}</span>}
        <div className="scroll-arrows flex items-center justify-center -space-x-1.5 rtl:space-x-reverse">
          <ChevronLeft size={11} strokeWidth={2.5} className="text-blue-500/70" />
          <ChevronLeft size={11} strokeWidth={2.5} className="text-blue-500/70" />
        </div>
      </button>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-4 custom-scrollbar scroll-smooth"
      >
        <div className="flex h-full flex-row justify-start gap-4 items-stretch">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- רכיבים ---

import UnifiedHeader from '@/components/UnifiedHeader';
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';

const Header = ({
  onRefresh, isLoading, lastUpdated, onUndoLastAction, canUndo,
  viewMode, setViewMode, selectedDate, setSelectedDate,
  showPending, setShowPending,
  stationView, setStationView, availableStations
}) => {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    localStorage.removeItem('currentCustomer');
    sessionStorage.removeItem('editOrderData');
    sessionStorage.removeItem('pendingCartState');
    sessionStorage.setItem('order_origin', 'kds');
    navigate('/?from=kds&new=true');
  };

  return (
    <UnifiedHeader
      hideTitle={true}
      showMusicPlayer={true}
      onHome={() => navigate('/mode-selection')}
      rightContent={
        <div className="flex items-center gap-2">
          {/* Refresh button next to Home */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all bg-white border border-slate-200 active:scale-95 shadow-sm bg-white ${isLoading ? 'text-blue-400 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
            title="רענן הזמנות"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      }
      headerTabs={[
        {
          id: 'active',
          label: 'פעיל',
          icon: <LayoutGrid size={16} />,
          isActive: viewMode === 'active',
          onClick: () => setViewMode('active'),
          colorClass: 'text-blue-600'
        },
        {
          id: 'history',
          label: 'היסטוריה',
          icon: <History size={16} />,
          isActive: viewMode === 'history',
          onClick: () => setViewMode('history'),
          colorClass: 'text-purple-600'
        }
      ]}
      leftTabContent={
        viewMode === 'active' && availableStations && (
          <div className="relative group shrink-0 h-9 md:h-10">
            <button className="flex items-center gap-2 px-3 md:px-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 font-bold transition-all h-full text-xs md:text-sm shadow-sm justify-between">
              <span>
                {stationView === 'Checker' ? 'צ׳קר' :
                 stationView === 'Kitchen' ? 'מטבח' :
                 stationView === 'Bar' ? 'בר' : stationView}
              </span>
              <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
            <div className="absolute top-full left-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden transform origin-top-left scale-95 group-hover:scale-100">
              <div className="p-1 flex flex-col gap-0.5" dir="rtl">
                {availableStations.map(station => (
                  <button key={station}
                    onClick={() => {
                      setStationView(station);
                      localStorage.setItem('kds_station_view', station);
                    }}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                      stationView === station
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      {station === 'Checker' ? 'צ׳קר' :
                       station === 'Kitchen' ? 'מטבח' :
                       station === 'Bar' ? 'בר' : station}
                    </span>
                    {stationView === station && <Check size={14} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      }
    />
  );
};


// --- לוגיקה ראשית ---

const KdsScreen = () => {
  console.log('%c[KDS-UI] 🚀 COMPONENT MOUNTING', 'color: #0ea5e9; font-weight: bold; font-size: 14px;');
  const { currentUser } = useAuth();
  const isLiteMode = React.useMemo(() => localStorage.getItem('lite_mode') === 'true', []);

  const {
    currentOrders,
    completedOrders,
    isLoading,
    lastUpdated,
    lastAction,
    smsToast,
    setSmsToast,
    errorModal,
    setErrorModal,
    isSendingSms,
    getSmsStatus,
    fetchOrders,
    fetchHistoryOrders,
    findNearestActiveDate,
    updateOrderStatus: updateOrderStatusBase,
    handleFireItems,
    handleReadyItems,
    handleDeliverItems,
    handleToggleEarlyDelivered,
    handleStationDelivered,
    handleRefireItem,
    availableStations,
    handleUndoLastAction,
    handleConfirmPayment,
    handleCancelOrder
  } = useKDSData();

  const [stationView, setStationView] = useState(
    () => localStorage.getItem('kds_station_view') || 'Checker'
  );

  useEffect(() => {
    console.log('%c[KDS-UI] 🖥️ Rendering KDS Screen...', 'color: #8b5cf6; font-weight: bold;', {
      current: currentOrders ? currentOrders.length : 0,
      completed: completedOrders ? completedOrders.length : 0,
      isLoading,
      businessId: currentUser?.business_id
    });
  }, [currentOrders?.length, completedOrders?.length, isLoading, currentUser?.business_id]);

  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const [showPending, setShowPending] = useState(true);

  const handleStatusUpdate = async (orderId, currentStatus) => {
    try {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.add(orderId);
        return next;
      });
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, 3000);

      await updateOrderStatusBase(orderId, currentStatus);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const location = useLocation();
  const [viewMode, setViewMode] = useState(() => {
    const isNavigationState = !!(location.state?.viewMode);
    if (isNavigationState) return location.state.viewMode;
    return 'active';
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem('kds_selectedDate');
    if (saved) {
      try {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) return d;
      } catch (e) { }
    }
    return new Date();
  });

  const [historyOrders, setHistoryOrders] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const navigate = useNavigate();
  const [historyInfoModal, setHistoryInfoModal] = useState({ isOpen: false, orderNumber: null });

  useEffect(() => {
    localStorage.setItem('kds_viewMode', viewMode);
    if (viewMode === 'history') {
      setSelectedDate(new Date());
    }
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('kds_selectedDate', selectedDate.toISOString());
  }, [selectedDate]);

  useEffect(() => {
    if (isEditModalOpen && editingOrder) {
      const allPossibleOrders = [...(currentOrders || []), ...(completedOrders || [])];
      const baseId = (editingOrder.originalOrderId || editingOrder.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
      const updated = allPossibleOrders.find(o => {
        const oBaseId = (o.originalOrderId || o.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
        return oBaseId === baseId;
      });

      if (updated && JSON.stringify(updated) !== JSON.stringify(editingOrder)) {
        setEditingOrder(updated);
      }
    }
  }, [currentOrders, completedOrders, isEditModalOpen]);

  const refreshTimeoutRef = useRef(null);
  const refreshControllerRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshTimeoutRef.current) return;
    if (refreshControllerRef.current) refreshControllerRef.current.abort();
    refreshControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchOrders(refreshControllerRef.current.signal),
        viewMode === 'history' ? setHistoryRefreshTrigger(prev => prev + 1) : Promise.resolve()
      ]);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
      }, 1000);
    }
  }, [fetchOrders, viewMode]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (refreshControllerRef.current) refreshControllerRef.current.abort();
    };
  }, []);

  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const prevCurrentOrdersRef = useRef(currentOrders);

  useEffect(() => {
    if (currentOrders.length > prevCurrentOrdersRef.current.length) {
      const newOrders = currentOrders.filter(o => !prevCurrentOrdersRef.current.find(p => p.id === o.id));
      if (newOrders.length > 0) {
        const idsToAdd = newOrders.map(o => o.id);
        setNewOrderIds(prev => {
          const next = new Set(prev);
          idsToAdd.forEach(id => next.add(id));
          return next;
        });

        setTimeout(() => {
          setNewOrderIds(prev => {
            const next = new Set(prev);
            idsToAdd.forEach(id => next.delete(id));
            return next;
          });
        }, 3000);
      }
    }
    prevCurrentOrdersRef.current = currentOrders;
  }, [currentOrders]);

  useEffect(() => {
    if (viewMode === 'history') {
      const controller = new AbortController();
      const loadHistory = async () => {
        setIsHistoryLoading(true);
        try {
          const data = await fetchHistoryOrders(selectedDate, controller.signal);
          if (!controller.signal.aborted) {
            setHistoryOrders(data || []);
          }
        } catch (err) {
          if (err.name !== 'AbortError') console.error("History load error", err);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      loadHistory();
      return () => controller.abort();
    }
  }, [viewMode, selectedDate, fetchHistoryOrders, historyRefreshTrigger]);

  const handlePaymentCollected = (order, fromHistory = false) => {
    setSelectedOrderForPayment({ ...order, _fromHistory: fromHistory });
  };

  const handleEditOrder = (order) => {
    if (viewMode === 'history') {
      const realOrderId = (order.originalOrderId || order.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
      // 🛡️ SAFETY: Validate that we have a real UUID, not an order_number
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realOrderId);
      if (!isUUID) {
        console.error('❌ Invalid order ID for edit (not a UUID):', realOrderId, 'Full order:', order);
        alert(`שגיאה: מזהה הזמנה לא תקין (${realOrderId}). נסה לרענן את הדף.`);
        return;
      }
      localStorage.removeItem('currentCustomer');
      sessionStorage.removeItem('editOrderData');
      sessionStorage.removeItem('pendingCartState');
      sessionStorage.setItem('order_origin', 'kds');
      navigate(`/?editOrderId=${realOrderId}&from=kds`);
      return;
    }
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingOrder(null);
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col font-heebo overflow-hidden" dir="rtl">
      <style>{kdsStyles}</style>


      <div className="w-full h-full flex flex-col relative">
        {(isLoading || isRefreshing) && (
          <div className="kds-loader-bar">
            <div className="kds-loader-progress" />
          </div>
        )}
        <Header
          onRefresh={handleRefresh}
          isLoading={isLoading || isHistoryLoading || isRefreshing}
          lastUpdated={lastUpdated}
          onUndoLastAction={handleUndoLastAction}
          canUndo={!!lastAction}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          showPending={showPending}
          setShowPending={setShowPending}
          stationView={stationView}
          setStationView={setStationView}
          availableStations={availableStations}
        />

        <KDSErrorBoundary>
          {viewMode === 'active' ? (() => {
            const filteredCurrentOrders = showPending
              ? currentOrders
              : currentOrders.filter(o => o.status !== 'pending');

            // Station-based filtering
            const isStationMode = stationView !== 'Checker';
            const stationOrders = !isStationMode
              ? filteredCurrentOrders
              : filteredCurrentOrders
                  .map(order => ({
                    ...order,
                    items: (order.items || []).filter(item => {
                      const areas = item.production_area?.split(',').map(s => s.trim()) || [];
                      return areas.includes(stationView);
                    })
                  }))
                  .filter(order => order.items.length > 0);

            // Station view: split into "active" (not yet sent) and "sent" (has early_delivered_at)
            const stationActiveOrders = !isStationMode ? stationOrders :
              stationOrders
                .map(order => ({
                  ...order,
                  items: (order.items || []).filter(i => !i.is_early_delivered)
                }))
                .filter(order => order.items.length > 0)
                // Strict Priority: urgent_at items float to top
                .sort((a, b) => {
                  const aUrgent = (a.items || []).some(i => i.urgent_at);
                  const bUrgent = (b.items || []).some(i => i.urgent_at);
                  if (aUrgent && !bUrgent) return -1;
                  if (!aUrgent && bUrgent) return 1;
                  return new Date(a.created_at) - new Date(b.created_at);
                });

            const stationSentOrders = !isStationMode ? [] :
              stationOrders
                .map(order => ({
                  ...order,
                  items: (order.items || []).filter(i => i.is_early_delivered)
                }))
                .filter(order => order.items.length > 0);

            return (
              <>
                {/* Floating Station Tabs removed and moved to Header */}

                {/* === CONDITIONAL KDS GRID === */}
                {/* If Checker -> 2 rows (50%/50%), If Station -> 1 row (100% height) */}
                <div className="h-[calc(100vh-50px)] md:h-[calc(100vh-65px)] flex flex-col w-full overflow-hidden bg-slate-100">
                  <div className={stationView === 'Checker' ? 'h-1/2 w-full min-h-0' : 'h-full w-full min-h-0'}>
                    <KDSScrollContainer
                      title={stationView === 'Checker' ? "בטיפול" : `${stationView} — בטיפול`}
                      orders={stationView === 'Checker' ? stationOrders : stationActiveOrders}
                      colorClass="border-b-4 border-gray-200 bg-slate-100/50"
                      badgeClass="bg-white/90 border border-gray-200 text-slate-600"
                    >
                        {(stationView === 'Checker' ? stationOrders : stationActiveOrders).map(order => {
                          const CardWrapper = isLiteMode ? 'div' : motion.div;
                          const wrapperProps = isLiteMode ? { className: "flex-shrink-0 kds-card-item h-full py-2" } : {
                            layout: false,
                            initial: { opacity: 0.8, scale: 0.98 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
                            transition: { opacity: { duration: 0.15 }, scale: { duration: 0.15 } },
                            className: "flex-shrink-0 kds-card-item h-full py-2"
                          };
                          return (
                            <CardWrapper key={order.id} {...wrapperProps}>
                              <OrderCard
                                key={order.id}
                                order={order}
                                glowClass={newOrderIds.has(order.id) ? (isLiteMode ? 'border-2 border-orange-400' : 'glow-active') : ''}
                                onOrderStatusUpdate={handleStatusUpdate}
                                onPaymentCollected={handlePaymentCollected}
                                onFireItems={handleFireItems}
                                onReadyItems={handleReadyItems}
                                onDeliverItems={handleDeliverItems}
                                onEditOrder={handleEditOrder}
                                onCancelOrder={handleCancelOrder}
                                onRefresh={fetchOrders}
                                onRefireItem={handleRefireItem}
                                getSmsStatus={getSmsStatus}
                                isStationView={isStationMode}
                              />
                            </CardWrapper>
                          );
                        })}
                      </KDSScrollContainer>
                    </div>

                    {stationView === 'Checker' && (
                      <div className="h-1/2 w-full min-h-0 bg-white">
                        <KDSScrollContainer
                          title="מוכן למסירה"
                          orders={completedOrders}
                          colorClass="bg-white"
                          badgeClass="bg-green-100 border border-green-200 text-green-700"
                        >
                          {completedOrders.map(order => {
                            const CardWrapper = isLiteMode ? 'div' : motion.div;
                            const wrapperProps = isLiteMode ? { className: "flex-shrink-0 kds-card-item h-full py-2" } : {
                              layout: false,
                              initial: { opacity: 0.8, scale: 0.98 },
                              animate: { opacity: 1, scale: 1 },
                              exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
                              transition: { opacity: { duration: 0.15 }, scale: { duration: 0.15 } },
                              className: "flex-shrink-0 kds-card-item h-full py-2"
                            };
                            return (
                              <CardWrapper key={order.id} {...wrapperProps}>
                                <OrderCard
                                  key={order.id}
                                  order={order}
                                  isReady={true}
                                  glowClass={newOrderIds.has(order.id) ? (isLiteMode ? 'border-2 border-green-400' : 'glow-ready') : ''}
                                  onOrderStatusUpdate={handleStatusUpdate}
                                  onPaymentCollected={handlePaymentCollected}
                                  onToggleEarlyDelivered={handleToggleEarlyDelivered}
                                  onDeliverItems={handleDeliverItems}
                                  onEditOrder={handleEditOrder}
                                  onCancelOrder={handleCancelOrder}
                                  onRefresh={fetchOrders}
                                  getSmsStatus={getSmsStatus}
                                />
                              </CardWrapper>
                            );
                          })}
                        </KDSScrollContainer>
                      </div>
                    )}
                  </div>
              </>
            );
          })() : (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
              <div className="flex-1 overflow-x-auto p-6 scroll-smooth custom-scrollbar">
                <div className="flex h-full flex-row justify-start gap-4 items-stretch">
                  {(() => {
                    const isStationMode = stationView !== 'Checker';
                    // Station-based filtering for history: only show items belonging to this station
                    const stationFilteredHistory = !isStationMode
                      ? historyOrders
                      : historyOrders
                          .map(order => ({
                            ...order,
                            items: (order.items || []).filter(item => {
                              const areas = item.production_area?.split(',').map(s => s.trim()) || [];
                              return areas.includes(stationView);
                            })
                          }))
                          .filter(order => order.items.length > 0);

                    return [...stationFilteredHistory].sort((a, b) => {
                      if (!isStationMode) {
                        if (!a.isPaid && b.isPaid) return -1;
                        if (a.isPaid && !b.isPaid) return 1;
                      }
                      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                    }).map(order => {
                      const CardWrapper = isLiteMode ? 'div' : motion.div;
                      const wrapperProps = isLiteMode ? { className: "flex-shrink-0 kds-card-item" } : {
                        layout: "position",
                        initial: { opacity: 0, scale: 0.95 },
                        animate: { opacity: 1, scale: 1 },
                        exit: { opacity: 0, scale: 0.95 },
                        transition: {
                          layout: { type: "spring", stiffness: 300, damping: 30 },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.2 }
                        },
                        className: "flex-shrink-0 kds-card-item"
                      };

                      return (
                        <CardWrapper key={order.id} {...wrapperProps}>
                          <OrderCard
                            order={order}
                            isHistory={true}
                            isStationView={isStationMode}
                            onPaymentCollected={!isStationMode ? handlePaymentCollected : undefined}
                            onEditOrder={!isStationMode ? handleEditOrder : undefined}
                          />
                        </CardWrapper>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <DateScroller selectedDate={selectedDate} onDateChange={setSelectedDate} />
                {isHistoryLoading && (
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-sm animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    טוען היסטוריה...
                  </div>
                )}
              </div>
            </div>
          )}
        </KDSErrorBoundary>
      </div>

      {smsToast && (
        <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${smsToast.isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {smsToast.isError ? <AlertTriangle size={24} /> : <Check size={24} />}
          <span className="text-xl font-bold">{smsToast.message}</span>
        </div>
      )}

      {errorModal && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-red-900">{errorModal.title}</h3>
                <p className="text-red-700 font-medium">{errorModal.message}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-sm text-gray-600 dir-ltr">
                {errorModal.details || 'Unknown Error'}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setErrorModal(null)} className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-xl hover:bg-gray-300 transition">ביטול</button>
                <button onClick={errorModal.onRetry} disabled={isSendingSms} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold text-xl hover:bg-slate-800 transition flex items-center justify-center gap-2">
                  {isSendingSms ? <RefreshCw className="animate-spin" /> : <><RefreshCw />{errorModal.retryLabel}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <KDSPaymentModal
        isOpen={!!selectedOrderForPayment}
        onClose={(closeInfo) => {
          setSelectedOrderForPayment(null);
          if (closeInfo?.showHistoryInfo) {
            setHistoryInfoModal({ isOpen: true, orderNumber: closeInfo.orderNumber });
          }
        }}
        order={selectedOrderForPayment}
        isFromHistory={selectedOrderForPayment?._fromHistory || false}
        onConfirmPayment={async (orderId, paymentMethod) => {
          try {
            await handleConfirmPayment(orderId, paymentMethod);
            setSelectedOrderForPayment(null);
            setViewMode('active');
            fetchOrders();
          } catch (err) { }
        }}
        onMoveToHistory={async (orderId) => {
          try {
            await updateOrderStatusBase(orderId, 'completed');
            await fetchOrders();
          } catch (err) { }
        }}
      />

      <HistoryInfoModal
        isOpen={historyInfoModal.isOpen}
        onClose={() => setHistoryInfoModal({ isOpen: false, orderNumber: null })}
        orderNumber={historyInfoModal.orderNumber}
      />

      <OrderEditModal
        isOpen={isEditModalOpen}
        order={editingOrder}
        onClose={handleCloseEditModal}
        onRefresh={fetchOrders}
        onToggleEarlyDelivered={handleToggleEarlyDelivered}
      />
    </div>
  );
};

export default KdsScreen;