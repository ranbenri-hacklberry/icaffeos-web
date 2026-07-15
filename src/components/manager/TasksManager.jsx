import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, X, Check, ClipboardList, ChevronLeft, Trash2, Coffee, ExternalLink } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { TASK_CATEGORIES, isCategoryMatch, getCategoryAliases } from '@/config/taskCategories';

// Variants for smooth animation
const taskVariants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }
};

const TasksManager = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Top Tabs: 'opening' | 'pre_closing' | 'closing'
  const [activeTab, setActiveTab] = useState('opening');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    is_pre_closing: false
  });

  // Prep Task Edit Modal
  const [showPrepEditModal, setShowPrepEditModal] = useState(false);
  const [prepEditTask, setPrepEditTask] = useState(null);
  const [prepSchedule, setPrepSchedule] = useState({});
  const [prepDescription, setPrepDescription] = useState('');

  // Menu Item Task Modal (can't edit here)
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [selectedMenuTask, setSelectedMenuTask] = useState(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'info'
  });

  // Centralized categories used for filtering
  const categoryMap = {
    'opening': getCategoryAliases('opening'),
    'pre_closing': getCategoryAliases('prep'),
    'closing': getCategoryAliases('closing')
  };

  // Track completed tasks for today (Map: task_id -> timestamp)
  const [completedToday, setCompletedToday] = useState(new Map());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];

      // Fetch tasks
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('business_id', currentUser?.business_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTasks(data || []);

      console.log('🔍 [TasksManager] Raw fetched tasks:', data?.length, data);
      if (data?.length > 0) {
        const sample = data[0];
        console.log('🔍 [TasksManager] Sample task:', {
          name: sample.name,
          category: sample.category,
          is_active: sample.is_active,
          frequency: sample.frequency,
          weekly_schedule: sample.weekly_schedule
        });
      }

      const { data: completions } = await supabase
        .from('task_completions')
        .select('recurring_task_id,completed_at')
        .eq('completion_date', dateStr);

      const completionMap = new Map();
      completions?.forEach(c => {
        if (c.completed_at) {
          completionMap.set(c.recurring_task_id, c.completed_at);
        }
      });
      // Force new map instance
      setCompletedToday(new Map(completionMap));
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.business_id]);

  useEffect(() => {
    fetchTasks();

    // Realtime subscription for completions (Sync with PrepPage)
    const channel = supabase
      .channel('tasks-manager-completions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions' },
        (payload) => {
          console.log('TasksManager: Completion update received', payload);
          fetchTasks(); // Simple and robust: refresh everything
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  // Filter tasks by current tab
  const filteredTasks = tasks.filter(task => {
    return isCategoryMatch(activeTab, task.category);
  });

  // Sort tasks: Scheduled for today + not completed FIRST
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const todayIdx = new Date().getDay();

    // Check if task is scheduled for today
    const isScheduledToday = (task) => {
      // Monthly: Only show on the first occurrence (first 7 days of month)
      if (task.frequency === 'Monthly') {
        const dom = new Date().getDate();
        if (dom > 7) return false;
      }

      const schedule = task.weekly_schedule || {};
      if (Object.keys(schedule).length > 0) {
        const config = schedule[todayIdx];
        return config && config.qty > 0;
      }
      if (task.day_of_week !== null && task.day_of_week !== undefined) {
        return task.day_of_week === todayIdx;
      }
      return false;
    };

    const aScheduled = isScheduledToday(a);
    const bScheduled = isScheduledToday(b);
    const aCompleted = completedToday.has(a.id);
    const bCompleted = completedToday.has(b.id);

    // Priority: Scheduled today + NOT completed
    const aPriority = aScheduled && !aCompleted;
    const bPriority = bScheduled && !bCompleted;

    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;

    // Secondary sort: alphabetical
    return a.name.localeCompare(b.name, 'he');
  });

  const handleTaskClick = (task) => {
    // If it's a prep task (in pre_closing tab), open prep edit modal
    if (activeTab === 'pre_closing') {
      setPrepEditTask(task);
      setPrepSchedule(task.weekly_schedule || {});
      setPrepDescription(task.description || '');
      setShowPrepEditModal(true);
    } else if (task.menu_item_id) {
      // Menu item task - show info modal
      setSelectedMenuTask(task);
      setShowMenuItemModal(true);
    } else {
      // Regular task - open edit modal
      // Extract selected days from weekly_schedule
      const schedule = task.weekly_schedule || {};
      const selectedDays = Object.keys(schedule)
        .filter(dayIdx => schedule[dayIdx]?.qty > 0)
        .map(d => parseInt(d));

      setEditingTask(task);
      setTaskForm({
        name: task.name || '',
        description: task.description || '',
        is_pre_closing: task.is_pre_closing || false,
        selectedDays: selectedDays.length > 0 ? selectedDays : [0, 1, 2, 3, 4, 5, 6]
      });
      setShowEditModal(true);
    }
  };

  const handleAddNew = () => {
    setEditingTask(null);
    setTaskForm({
      name: '',
      description: '',
      is_pre_closing: activeTab === 'pre_closing',
      selectedDays: [0, 1, 2, 3, 4, 5, 6] // Default: all days
    });
    setShowEditModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.name.trim()) return;

    try {
      // Map tab to correct category
      const categoryByTab = {
        'opening': 'פתיחה',
        'pre_closing': 'הכנות',
        'closing': 'סגירה'
      };
      const category = categoryByTab[activeTab] || 'פתיחה';

      const selectedDays = taskForm.selectedDays || [0, 1, 2, 3, 4, 5, 6];
      const weeklySchedule = {};
      selectedDays.forEach(dayIdx => {
        weeklySchedule[dayIdx] = { qty: 1, mode: 'fixed' };
      });

      const payload = {
        name: taskForm.name,
        description: taskForm.description,
        is_pre_closing: taskForm.is_pre_closing,
        weekly_schedule: weeklySchedule,
        frequency: taskForm.frequency || 'Daily',
        business_id: currentUser?.business_id,
        // 🆕 Populate day_of_week for Weekly/Monthly clarity
        day_of_week: (taskForm.frequency === 'Weekly' || taskForm.frequency === 'Monthly') && selectedDays.length > 0
          ? selectedDays[0]
          : null
      };

      if (editingTask) {
        // Update existing
        const { error } = await supabase
          .from('recurring_tasks')
          .update(payload)
          .eq('id', editingTask.id)
          .eq('business_id', currentUser?.business_id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('recurring_tasks')
          .insert([{
            ...payload,
            category: category,
            is_active: true
          }]);

        if (error) throw error;
      }

      setShowEditModal(false);
      fetchTasks();
    } catch (err) {
      console.error('Error saving task:', err);
      alert('שגיאה בשמירת המשימה');
    }
  };

  const handleDeleteTask = (task) => {
    setConfirmModal({
      isOpen: true,
      title: 'מחיקת משימה',
      message: `האם אתה בטוח שברצונך למחוק את המשימה "${task.name}"?`,
      variant: 'danger',
      confirmText: 'מחק',
      onConfirm: () => executeDeleteTask(task.id)
    });
  };

  const executeDeleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('recurring_tasks')
        .update({ is_active: false })
        .eq('id', taskId)
        .eq('business_id', currentUser?.business_id);

      if (error) throw error;
      fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const goToMenuItem = () => {
    if (selectedMenuTask?.menu_item_id) {
      navigate('/data-manager-interface', {
        state: {
          activeTab: 'menu',
          editItemId: selectedMenuTask.menu_item_id
        }
      });
    }
    setShowMenuItemModal(false);
  };

  // Prep schedule helpers
  const updateDayQty = (dayIdx, qty) => {
    setPrepSchedule(prev => ({
      ...prev,
      [dayIdx]: { ...prev[dayIdx], qty: Math.max(0, qty), mode: 'par_level' }
    }));
  };

  const savePrepSchedule = async () => {
    if (!prepEditTask?.id) return;
    try {
      const { error } = await supabase
        .from('recurring_tasks')
        .update({
          weekly_schedule: prepSchedule,
          description: prepDescription
        })
        .eq('id', prepEditTask.id);

      if (error) throw error;

      setShowPrepEditModal(false);
      fetchTasks();
    } catch (err) {
      console.error('Error saving prep schedule:', err);
      alert('שגיאה בשמירת הכמויות');
    }
  };

  // Toggle task completion (mark/unmark)
  const toggleTaskCompletion = async (task) => {
    if (!task?.id) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const isCompleted = completedToday.has(task.id);

    try {
      if (isCompleted) {
        // Unmark: Delete completion record
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('recurring_task_id', task.id)
          .eq('completion_date', dateStr);

        if (error) throw error;

        // Update local state - Remove ID
        setCompletedToday(prev => {
          const next = new Map(prev);
          next.delete(task.id);
          return next;
        });
      } else {
        // Mark: Insert completion record
        const todayIdx = new Date().getDay();
        const todayQty = task.weekly_schedule?.[todayIdx]?.qty || task.quantity || 1;

        const { data, error } = await supabase.from('task_completions').insert({
          recurring_task_id: task.id,
          business_id: currentUser?.business_id,
          quantity_produced: todayQty,
          completion_date: dateStr,
          completed_by: currentUser?.id
        }).select().single();

        if (error) throw error;

        // Update local state - Add ID with timestamp
        setCompletedToday(prev => new Map(prev).set(task.id, data?.completed_at || new Date().toISOString()));
        setShowPrepEditModal(false); // Close modal if marking complete from there
      }
    } catch (err) {
      console.error('Error toggling task completion:', err);
      alert('שגיאה בעדכון סטוס המשימה');
    }
  };

  const DAYS_HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const DAYS_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const tabLabels = {
    'opening': 'פתיחה',
    'pre_closing': 'הכנות',
    'closing': 'סגירה'
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 font-heebo pt-4" dir="rtl">

      {/* Header */}
      <div className="bg-white shrink-0 z-20 shadow-sm border-b border-gray-100 pb-2">
        <div className="px-4 py-3 flex justify-between items-center relative">
          <div className="w-1/4"></div>

          {/* Centered Tabs - Match SalesDashboard Style */}
          <div className="absolute left-1/2 -translate-x-1/2 flex bg-gray-100 p-1 rounded-xl w-full max-w-sm">
            {['opening', 'pre_closing', 'closing'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div className="w-1/4 flex justify-end"></div>
        </div>

        {/* Add button only */}
        <div className="px-4 py-2 flex justify-end max-w-4xl mx-auto w-full">
          <button
            onClick={handleAddNew}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlusCircle size={20} />
            <span>משימה חדשה</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3 max-w-3xl mx-auto pb-20 pt-4 px-4"
          >
            {filteredTasks.length === 0 ? (
              <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-4">
                <ClipboardList size={48} className="text-gray-200" />
                <p className="text-lg font-bold text-gray-500">אין משימות {tabLabels[activeTab]}</p>
                <button
                  onClick={handleAddNew}
                  className="text-blue-600 font-bold hover:underline"
                >
                  הוסף משימה ראשונה
                </button>
              </div>
            ) : (
              <>
                {/* Pending Tasks Section */}
                {sortedTasks.filter(task => {
                  const todayIdx = new Date().getDay();
                  const schedule = task.weekly_schedule || {};
                  const todayConfig = schedule[todayIdx];
                  const todayQty = todayConfig?.qty || task.quantity || 0;
                  const hasTodayTask = todayQty > 0;
                  const isCompleted = completedToday.has(task.id);
                  return hasTodayTask && !isCompleted;
                }).length > 0 && (
                    <div className="mb-2">
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider mb-2 px-2">
                        ⏳ ממתינות לביצוע היום
                      </h3>
                    </div>
                  )}

                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {sortedTasks
                      .map(task => {
                        // Get today's quantity from weekly_schedule
                        const todayIdx = new Date().getDay();
                        const schedule = task.weekly_schedule || {};
                        const todayConfig = schedule[todayIdx];
                        const todayQty = todayConfig?.qty || task.quantity || 0;
                        const isPrepTask = activeTab === 'pre_closing';
                        const hasTodayTask = todayQty > 0;
                        const isCompleted = completedToday.has(task.id);
                        const isUrgent = hasTodayTask && !isCompleted; // Scheduled today + not done

                        // Get days with tasks
                        const daysWithTasks = Object.entries(schedule)
                          .filter(([_, config]) => config?.qty > 0)
                          .map(([day]) => ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][parseInt(day)]);

                        return (
                          <motion.div
                            key={task.id}
                            layout
                            transition={{
                              layout: { type: "tween", duration: 0.8, ease: [0.22, 1, 0.36, 1] },
                              opacity: { duration: 0.5 }
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={() => handleTaskClick(task)}
                            className={`bg-white rounded-xl shadow-sm border p-2 pr-2 flex items-center gap-3 relative cursor-pointer group h-[88px] ${isCompleted
                              ? 'border-green-300 bg-green-50/50'
                              : isUrgent
                                ? 'border-orange-300 bg-orange-50/30 ring-2 ring-orange-200'
                                : isPrepTask && !hasTodayTask
                                  ? 'border-gray-200 opacity-50'
                                  : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/50'
                              }`}
                          >
                            {/* Icon / Complete Action Area (Right visually, Start of DOM) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskCompletion(task);
                              }}
                              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center transition-all ${isCompleted
                                ? 'bg-green-600 text-white shadow-md shadow-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600 active:scale-90 cursor-pointer'
                                }`}
                            >
                              {isCompleted ? (
                                <div className="flex flex-col items-center justify-center p-1">
                                  <Check size={28} strokeWidth={3} className="mb-0.5" />
                                  <span className="text-[10px] font-bold opacity-90 leading-none">
                                    {(() => {
                                      const ts = completedToday.get(task.id);
                                      if (!ts) return '';
                                      try {
                                        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      } catch (e) {
                                        return '';
                                      }
                                    })()}
                                  </span>
                                </div>
                              ) : isPrepTask && todayQty > 0 ? (
                                <div className="flex flex-col items-center">
                                  <Check size={18} className="mb-px opacity-30" />
                                  <span className="text-xl font-black leading-none">{todayQty}</span>
                                  <span className="text-[10px] font-bold opacity-70">יח׳</span>
                                </div>
                              ) : task.menu_item_id ? (
                                <Coffee size={24} />
                              ) : (
                                <ClipboardList size={24} />
                              )}
                            </div>

                            {/* Content (Middle) */}
                            <div className="flex-1 flex flex-col justify-center min-w-0 h-full py-1">
                              <h3 className="font-bold text-gray-800 text-base leading-tight truncate mb-1 group-hover:text-blue-700 transition-colors">
                                {task.name}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                {task.menu_item_id && (
                                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                    מתפריט
                                  </span>
                                )}
                                {isPrepTask && daysWithTasks.length > 0 && (
                                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                    {daysWithTasks.join(' ')}
                                  </span>
                                )}
                                {!isPrepTask && task.description && (
                                  <span className="text-xs text-gray-400 truncate max-w-[150px]">
                                    {task.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions (Left visually, End of DOM) */}
                            <div className="pl-2 flex-shrink-0 flex items-center gap-2">
                              {!task.menu_item_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task);
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <ChevronLeft size={18} className="text-gray-300" />
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {showEditModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-[32px] shadow-2xl p-0 max-h-[92dvh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 pb-4 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors z-10"
                >
                  <X size={24} />
                </button>
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-800 text-center">
                  {editingTask ? 'עריכת משימה' : 'משימה חדשה'}
                </h3>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-sm font-bold text-slate-500 mb-1 block">שם המשימה</label>
                  <input
                    type="text"
                    value={taskForm.name}
                    onChange={e => setTaskForm({ ...taskForm, name: e.target.value })}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-bold text-xl"
                    placeholder="שם המשימה..."
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-500 mb-1 block">תיאור / הוראות (אופציונלי)</label>
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-medium text-base min-h-[120px] resize-none"
                    placeholder="הוראות ביצוע, הערות..."
                  />
                </div>

                {/* Pre-closing toggle (only for closing tasks) */}
                {(activeTab === 'closing' || activeTab === 'pre_closing') && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-slate-700">אפשר לבצע לפני סגירה</span>
                        <p className="text-xs text-gray-400 mt-0.5">משימה שניתן להתחיל בזמן שהמקום עוד פתוח</p>
                      </div>
                      <div
                        onClick={() => setTaskForm({ ...taskForm, is_pre_closing: !taskForm.is_pre_closing })}
                        className={`w-14 h-8 rounded-full transition-colors relative ${taskForm.is_pre_closing ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${taskForm.is_pre_closing ? 'right-1' : 'left-1'}`} />
                      </div>
                    </label>
                  </div>
                )}

                {/* Frequency & Days Selection */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">

                  {/* Frequency Toggle */}
                  <div className="flex bg-gray-200/50 p-1 rounded-xl">
                    {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => {
                          // Reset selection when mode changes
                          const isNewMode = taskForm.frequency !== freq;
                          setTaskForm({
                            ...taskForm,
                            frequency: freq,
                            selectedDays: isNewMode ? (freq === 'Daily' ? [0, 1, 2, 3, 4, 5, 6] : [0]) : taskForm.selectedDays
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${(taskForm.frequency || 'Daily') === freq
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        {freq === 'Daily' ? 'יומי' : (freq === 'Weekly' ? 'שבועי' : 'חודשי')}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 block">
                      {(taskForm.frequency || 'Daily') === 'Daily' ? 'ימי ביצוע' : 'יום לביצוע'}
                    </label>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {DAYS_FULL.map((dayName, idx) => {
                        const isSelected = taskForm.selectedDays?.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const currentMode = taskForm.frequency || 'Daily';
                              if (currentMode === 'Daily') {
                                // Multi-select
                                const current = taskForm.selectedDays || [];
                                const updated = isSelected
                                  ? current.filter(d => d !== idx)
                                  : [...current, idx].sort();
                                setTaskForm({ ...taskForm, selectedDays: updated });
                              } else {
                                // Single-select for Weekly/Monthly
                                setTaskForm({ ...taskForm, selectedDays: [idx] });
                              }
                            }}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${isSelected
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white text-gray-400 border border-gray-200'
                              }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation Text */}
                  <div className="text-xs text-gray-400 text-center bg-white p-2 rounded-lg border border-gray-100/50">
                    {(taskForm.frequency || 'Daily') === 'Daily' && 'המשימה תופיע בכל הימים שנבחרו.'}
                    {(taskForm.frequency || 'Daily') === 'Weekly' && `המשימה תופיע בכל יום ${DAYS_FULL[taskForm.selectedDays?.[0] || 0]} בשבוע.`}
                    {(taskForm.frequency || 'Daily') === 'Monthly' && `המשימה תופיע ביום ראשון הראשון של כל חודש (אם נבחר יום ראשון).`}
                  </div>

                  {(taskForm.frequency || 'Daily') === 'Daily' && (
                    <button
                      type="button"
                      onClick={() => setTaskForm({ ...taskForm, selectedDays: [0, 1, 2, 3, 4, 5, 6] })}
                      className="mt-1 w-full py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      בחר הכל
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                <button
                  onClick={handleSaveTask}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all"
                >
                  {editingTask ? 'שמור שינויים' : 'צור משימה'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Menu Item Task Modal */}
      <AnimatePresence>
        {showMenuItemModal && selectedMenuTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenuItemModal(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto">
                {/* Header */}
                <div className="p-6 bg-amber-50/50 border-b border-amber-100 text-center">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coffee size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">משימת הכנת מנה</h3>
                  <p className="text-base font-bold text-amber-700 mt-2">{selectedMenuTask.name}</p>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                      משימה זו נוצרה אוטומטית מהגדרות הפריט בתפריט.
                      <br />
                      כדי לערוך אותה, יש לגשת לפריט עצמו בניהול התפריט.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
                  <button
                    onClick={() => setShowMenuItemModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={goToMenuItem}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={18} />
                    עבור לפריט
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Prep Task Edit Modal */}
      <AnimatePresence>
        {showPrepEditModal && prepEditTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrepEditModal(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-[32px] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 pb-4 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                <button
                  onClick={() => setShowPrepEditModal(false)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors z-10"
                >
                  <X size={24} />
                </button>
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-800 text-center">
                  {prepEditTask.name}
                </h3>
                {prepEditTask.menu_item_id && (
                  <p className="text-sm text-amber-600 text-center mt-1 font-bold">מקושר לפריט בתפריט</p>
                )}
              </div>

              {/* Schedule Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-sm text-gray-500 text-center mb-4">הגדר כמה יחידות להכין בכל יום</p>
                <div className="grid grid-cols-7 gap-1 max-w-md mx-auto">
                  {DAYS_HEB.map((dayLabel, idx) => {
                    const dayQty = prepSchedule[idx]?.qty || 0;
                    const isActive = dayQty > 0;
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <span className={`text-xs font-bold mb-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                          {dayLabel}
                        </span>
                        {/* Up Arrow */}
                        <button
                          onClick={() => updateDayQty(idx, dayQty + 1)}
                          className="w-10 h-10 rounded-t-xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-green-100 hover:text-green-600 transition-colors border border-gray-200 border-b-0"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        {/* Quantity Display */}
                        <div className={`w-10 h-10 flex items-center justify-center text-lg font-black transition-all border-x ${isActive ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-400 border-gray-200'
                          }`}>
                          {dayQty}
                        </div>
                        {/* Down Arrow */}
                        <button
                          onClick={() => updateDayQty(idx, dayQty - 1)}
                          className="w-10 h-10 rounded-b-xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors border border-gray-200 border-t-0"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Description / Notes Edit */}
                <div className="mt-6 px-4 max-w-md mx-auto">
                  <label className="text-xs font-bold text-gray-400 mb-1 block mr-1">הערות / הוראות הכנה</label>
                  <textarea
                    value={prepDescription}
                    onChange={(e) => setPrepDescription(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[80px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-all"
                    placeholder="הוסף הערות לצוות (לדוגמה: להפשיר בבוקר...)"
                  />
                </div>

                {/* Quick Set */}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      const newSchedule = {};
                      [0, 1, 2, 3, 4].forEach(d => { newSchedule[d] = { qty: 5, mode: 'par_level' }; });
                      setPrepSchedule(newSchedule);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    א-ה: 5
                  </button>
                  <button
                    onClick={() => {
                      const newSchedule = {};
                      [0, 1, 2, 3, 4, 5, 6].forEach(d => { newSchedule[d] = { qty: 10, mode: 'par_level' }; });
                      setPrepSchedule(newSchedule);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    כל יום: 10
                  </button>
                  <button
                    onClick={() => setPrepSchedule({})}
                    className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    איפוס
                  </button>
                </div>

                {/* Link to menu item */}
                {prepEditTask.menu_item_id && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        setShowPrepEditModal(false);
                        navigate('/data-manager-interface', {
                          state: { activeTab: 'menu', editItemId: prepEditTask.menu_item_id }
                        });
                      }}
                      className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center gap-1"
                    >
                      <ExternalLink size={14} />
                      עבור לפריט בתפריט
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-gray-100 bg-white shrink-0 space-y-2">
                {/* Toggle Complete Button */}
                <button
                  onClick={() => toggleTaskCompletion(prepEditTask)}
                  className={`w-full py-4 rounded-2xl font-black text-xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${completedToday.has(prepEditTask.id)
                    ? 'bg-green-100 text-green-800 shadow-none'
                    : 'bg-green-600 text-white shadow-green-200'
                    }`}
                >
                  <Check size={24} />
                  {completedToday.has(prepEditTask.id) ? 'הושלם היום (לחץ לביטול)' : 'סמן כהושלם'}
                </button>

                {/* Save Schedule Button */}
                <button
                  onClick={savePrepSchedule}
                  className="w-full py-3 bg-slate-200 text-slate-700 rounded-2xl font-bold text-base active:scale-[0.98] transition-all"
                >
                  שמור שינויי לו״ז
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
};

export default TasksManager;

