import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { createManagerOrder, updateManagerOrder } from '@/lib/managerApi';

const ORDER_STATUSES = [
  { value: 'pending', label: 'ממתין' },
  { value: 'in_progress', label: 'בהכנה' },
  { value: 'ready', label: 'מוכן' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

const TasksScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [filter, setFilter] = useState('active');
  const [manualOrder, setManualOrder] = useState({
    customer_name: '',
    items_summary: '',
    total: '',
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (supabaseError) throw supabaseError;
      setOrders(data || []);
    } catch (err) {
      setError(err?.message || 'שגיאה בטעינת הזמנות');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (filter === 'active') {
      return orders.filter(
        (order) => !['completed', 'cancelled'].includes(order.status)
      );
    }
    if (filter === 'completed') {
      return orders.filter((order) => order.status === 'completed');
    }
    if (filter === 'all') {
      return orders;
    }
    return orders;
  }, [orders, filter]);

  const handleStatusChange = async (orderId, status) => {
    try {
      setError('');
      await updateManagerOrder(orderId, { status });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status } : order
        )
      );
      setStatusMessage('סטטוס ההזמנה עודכן בהצלחה (Cloud Run)');
    } catch (err) {
      setError(err?.message || 'שגיאה בעדכון ההזמנה');
    }
  };

  const handleManualOrder = async (event) => {
    event.preventDefault();
    if (!manualOrder.customer_name || !manualOrder.items_summary) {
      setError('מלא שם לקוח וסיכום פריטים');
      return;
    }
    try {
      setError('');
      await createManagerOrder({
        ...manualOrder,
        total: Number(manualOrder.total) || 0,
        status: 'pending',
        source: 'manager-dashboard',
      });
      setManualOrder({ customer_name: '', items_summary: '', total: '' });
      setStatusMessage('הזמנה חדשה נוצרה ידנית ונשלחה ל-Cloud Run');
      fetchOrders();
    } catch (err) {
      setError(err?.message || 'שגיאה ביצירת ההזמנה');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow px-6 py-6 space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">הזמנות / KDS</h2>
          <p className="text-sm text-gray-500">עדכוני הזמנות דרך שירות Cloud Run</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'active', label: 'פעילות' },
            { id: 'completed', label: 'הושלמו' },
            { id: 'all', label: 'הכל' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {statusMessage && (
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded text-sm">{statusMessage}</div>
      )}
      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">טוען הזמנות...</p>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          אין הזמנות להצגה במסנן הנוכחי.
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="border border-gray-100 rounded-lg p-4 shadow-sm space-y-2"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {order.customer_name || 'לקוח אנונימי'}
                  </p>
                  <p className="text-xs text-gray-400">
                    #{order.id} • {new Date(order.created_at).toLocaleTimeString('he-IL')}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-lg font-bold text-gray-900">
                    ₪{Number(order.total || 0).toFixed(0)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {order.items_summary || '—'}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      <form
        onSubmit={handleManualOrder}
        className="border border-blue-100 rounded-lg p-4 space-y-3 bg-blue-50/40"
      >
        <h3 className="text-lg font-semibold text-blue-900">יצירת הזמנה ידנית</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={manualOrder.customer_name}
            onChange={(e) => setManualOrder({ ...manualOrder, customer_name: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg"
            placeholder="שם לקוח"
          />
          <input
            type="number"
            min="0"
            value={manualOrder.total}
            onChange={(e) => setManualOrder({ ...manualOrder, total: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-right"
            placeholder={'סה"כ (₪)'}
          />
          <textarea
            value={manualOrder.items_summary}
            onChange={(e) => setManualOrder({ ...manualOrder, items_summary: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg md:col-span-3"
            placeholder="פירוט ההזמנה"
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setManualOrder({ customer_name: '', items_summary: '', total: '' })}
            className="px-4 py-2 text-sm text-gray-600 underline"
          >
            איפוס
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            צור הזמנה בענן
          </button>
        </div>
      </form>
    </div>
  );
};

export default TasksScreen;
