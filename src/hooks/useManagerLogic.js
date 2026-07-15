import { useState } from 'react';
import {
  fetchManagerMenuItems,
  updateManagerMenuItem,
} from '@/lib/managerApi';
import { useAuth } from '@/context/AuthContext';

export const useManagerLogic = () => {
  const { currentUser } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllData = async (command = 'תפריט') => {
    setIsLoading(true);
    try {
      const items = await fetchManagerMenuItems(command, currentUser?.business_id);
      setMenuItems(items || []);
      setStatusMessage('');
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err?.message || 'שגיאה בטעינת התפריט מהשרת');
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = (item) => {
    setSelectedItem(item);
    setEditingItem(null);
    setEditForm(item ? { ...item } : {});
  };

  const startEdit = () => {
    if (!selectedItem) return;
    setEditingItem(selectedItem.id);
    setEditForm({ ...selectedItem });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = async (overrides, optionGroups) => {
    if (!editingItem) return;
    try {
      const formData = overrides || editForm;

      const apiResult = await updateManagerMenuItem(editingItem, formData);
      const mergedItem = {
        ...(selectedItem || {}),
        ...formData,
        ...(apiResult || {}),
      };

      const updatedData = menuItems.map((item) =>
        item.id === editingItem ? mergedItem : item
      );
      setMenuItems(updatedData);
      setSelectedItem(mergedItem);
      setEditingItem(null);
      setStatusMessage(`הפריט "${mergedItem?.name || formData?.name}" עודכן בהצלחה!`);
      setErrorMessage('');

      if (optionGroups) {
        console.log('Option groups payload ready for backend:', optionGroups);
      }
    } catch (err) {
      setErrorMessage(`שגיאה בעדכון: ${err?.message || 'שגיאת שרת'}`);
    }
  };

  return {
    menuItems,
    selectedItem,
    editingItem,
    editForm,
    statusMessage,
    errorMessage,
    isLoading,
    fetchAllData,
    openDetails,
    startEdit,
    cancelEdit,
    saveEdit,
    setEditForm,
  };
};

