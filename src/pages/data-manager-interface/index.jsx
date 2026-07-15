import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useManagerLogic } from '@/hooks/useManagerLogic';
import MenuDisplay from '@/components/manager/MenuDisplay';
import ItemDetails from '@/components/manager/ItemDetails';
import InventoryScreen from '@/components/manager/InventoryScreen';
import SalesDashboard from '@/components/manager/SalesDashboard';
import TasksManager from '@/components/manager/TasksManager';
import EmployeeManager from '@/components/manager/EmployeeManager';
import SystemDiagnostics from '@/components/manager/SystemDiagnostics';
import WeeklyReport from '@/components/manager/WeeklyReport';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';
import { useAuth } from '@/context/AuthContext';
import ManagerHeader from '@/components/manager/ManagerHeader';
import BusinessInfoBar from '@/components/BusinessInfoBar';
import { LogOut } from 'lucide-react';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialTab = useMemo(() => queryParams.get('tab') || location.state?.initialTab || 'orders', [queryParams, location.state]);
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [menuView, setMenuView] = useState('grid'); // 'grid' | 'details'

  useEffect(() => {
    const tabFromUrl = queryParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [queryParams, activeTab]);

  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('send_kds_heartbeat');
      } catch (err) {
        // Silent fail
      }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, []);

  const {
    menuItems,
    selectedItem,
    editingItem,
    editForm,
    setEditForm,
    statusMessage,
    errorMessage,
    isLoading,
    fetchAllData,
    openDetails,
    startEdit,
    cancelEdit,
    saveEdit,
  } = useManagerLogic();

  useEffect(() => {
    if (currentUser?.business_id) {
      fetchAllData();
    }
  }, [currentUser?.business_id]);



  useEffect(() => {
    const authKey = localStorage.getItem('manager_auth_key');
    if (!authKey) return;
    window.history.pushState(null, document.title, window.location.href);
    const handlePopState = (event) => {
      window.history.pushState(null, document.title, window.location.href);
      // Modal removed - back button is blocked
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    try {
      const authKey = localStorage.getItem('manager_auth_key');
      if (authKey) {
        const decoded = JSON.parse(decodeURIComponent(atob(authKey)));
        if (decoded.isImpersonated) {
          setIsImpersonating(true);
        }
      }
    } catch (e) {
      console.error('Error parsing auth key', e);
    }
  }, []);

  const handleLogout = () => {
    const wasImpersonating = isImpersonating;
    localStorage.removeItem('manager_auth_key');
    localStorage.removeItem('manager_auth_time');
    localStorage.removeItem('manager_employee_id');
    if (wasImpersonating) {
      navigate('/super-admin');
    } else {
      navigate('/mode-selection');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50" dir="rtl">
      <ManagerHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        isImpersonating={isImpersonating}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full flex flex-col"
          >
            {activeTab === 'orders' && <SalesDashboard />}
            {activeTab === 'reports' && (
              <WeeklyReport 
                initialWeekOffset={
                  queryParams.get('week') !== null 
                    ? Number(queryParams.get('week')) 
                    : -1
                } 
              />
            )}
            {activeTab === 'settings' && <EmployeeManager />}
          </motion.div>
        </AnimatePresence>
      </main>


    </div>
  );
};

export default ManagerDashboard;
