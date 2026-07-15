import { OptionGroup } from '@/components/manager/types';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';

import { getBackendApiUrl } from '@/utils/apiUtils';

const API_BASE_URL = getBackendApiUrl();

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

const buildUrl = (path = '') => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path}`;
};

const handleJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
};

const categorizeGroup = (name?: string | null) => {
  if (!name) return 'general';
  const normalized = name.toLowerCase();
  if (normalized.includes('חלב') || normalized.includes('milk')) return 'milk';
  if (normalized.includes('קצף') || normalized.includes('foam')) return 'texture';
  if (normalized.includes('טמפרטורה') || normalized.includes('temperature')) return 'temperature';
  return 'general';
};

export const normalizeOptionGroups = (rawGroups: any[] = []): OptionGroup[] => {
  return rawGroups
    .filter(Boolean)
    .map((group) => {
      const values = Array.isArray(group?.values) ? group.values 
                   : (Array.isArray(group?.options) ? group.options 
                   : (Array.isArray(group?.items) ? group.items : []));
      const title = group?.title || group?.name || group?.group || 'אפשרות';

      // Support both table format (is_required) and JSONB format (requirement: "M"/"O")
      const isRequired = group?.is_required ?? group?.required ?? (group?.requirement === 'M' || group?.requirement === 'MANDATORY');
      // Support both is_multiple_select and maxSelection > 1
      const isMulti = group?.is_multiple_select ?? (Number(group?.maxSelection ?? 1) > 1);

      return {
        id: String(group?.id ?? group?.group_id ?? crypto.randomUUID?.() ?? Date.now()),
        title: title,
        type: isMulti ? 'multi' : (group?.type || 'single'),
        category: group?.category || categorizeGroup(title),
        required: Boolean(isRequired),
        is_required: Boolean(isRequired),
        min_selection: Number(group?.min_selection ?? group?.minSelection ?? (isRequired ? 1 : 0)),
        max_selection: Number(group?.max_selection ?? group?.maxSelection ?? (isMulti ? 99 : 1)),
        description: group?.description ?? null,
        values: values
          .filter(Boolean)
          .map((value: any, vIdx: number) => {
            const price = Number(value?.price ?? value?.price_adjustment ?? 0);
            return {
              id: String(value?.id ?? value?.value_id ?? `${title}_${vIdx}`),
              name: value?.name || value?.value_name || 'בחירה',
              price: price,
              priceAdjustment: price,
              is_default: Boolean(value?.is_default ?? value?.isDefault),
              inventory_item_id: value?.inventory_item_id ?? null,
              replaces_inventory_item_id: value?.replaces_inventory_item_id ?? null,
              inhibits_ingredient_id: value?.inhibits_ingredient_id ?? value?.replaces_inventory_item_id ?? null,
              quantity: value?.quantity ?? null,
              description: value?.description ?? null,
              metadata: value?.metadata ?? null,
            };
          }),
      };
    });
};

export const fetchManagerMenuItems = async (command = 'תפריט', businessId?: string) => {
  const payload = {
    command,
    business_id: businessId
  };
  const response = await fetch(buildUrl('/'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const result = await handleJson<any>(response);
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.menuItems)) return result.menuItems;
  return [];
};

export const updateManagerMenuItem = async (id: string | number, updates: Record<string, any>) => {
  const response = await fetch(buildUrl(`/item/${id}`), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(updates),
  });
  const payload = await handleJson<{ updatedItem?: Record<string, any> }>(response);
  return payload?.updatedItem || updates;
};

const optionsCache: Record<string, OptionGroup[]> = {};

export const fetchManagerItemOptions = async (itemId: string | number, businessId?: string): Promise<OptionGroup[]> => {
  const cacheKey = `${businessId}_${itemId}`;
  if (optionsCache[cacheKey]) {
    console.log('⚡ Using Memory Cache for Options:', itemId);
    return optionsCache[cacheKey];
  }

  const idNum = Number(itemId);
  const idStr = String(itemId);

  // Strategy 1: Try Local Dexie DB first (Fastest & Offline)
  // Reads modifiers JSONB directly from menu_items store
  try {
    const localItem = await db.menu_items.get(isNaN(idNum) ? idStr : idNum);
    const mods = localItem?.modifiers;

    if (Array.isArray(mods) && mods.length > 0) {
      console.log('💾 Loaded Modifiers from Dexie (JSONB):', mods.length, 'groups');
      const normalized = normalizeOptionGroups(mods);
      optionsCache[cacheKey] = normalized;
      return normalized;
    }
  } catch (err) {
    console.warn('⚠️ Dexie lookup failed, falling back to network:', err);
  }

  // Strategy 2: Fallback to Supabase Direct (if online)
  // Reads modifiers JSONB from menu_items table
  try {
    console.log('🌐 Fetching Modifiers from Supabase (JSONB)...');

    const { data, error } = await supabase
      .from('menu_items')
      .select('modifiers')
      .eq('id', idStr)
      .single();

    if (!error && data?.modifiers && Array.isArray(data.modifiers) && data.modifiers.length > 0) {
      const normalized = normalizeOptionGroups(data.modifiers);
      optionsCache[cacheKey] = normalized;
      return normalized;
    }
  } catch (err) {
    console.error('❌ Supabase fetch failed:', err);
  }

  console.warn('⚠️ No modifiers found (Local & Remote) for item:', itemId);
  return [];
};

// Clear cache for a specific item or all items
export const clearOptionsCache = (itemId?: string | number) => {
  if (itemId) {
    delete optionsCache[String(itemId)];
  } else {
    Object.keys(optionsCache).forEach(key => delete optionsCache[key]);
  }
};

export const fetchInventoryItems = async (businessId: string) => {
  if (!businessId) throw new Error('businessId is required for inventory fetch');

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('business_id', businessId) // Crucial Multi-tenant filter
    .order('name');

  if (error) throw error;

  // Map DB fields to frontend expected fields if necessary
  return (data || []).map(item => ({
    ...item,
    par_level: item.low_stock_threshold_units, // Map low_stock_threshold_units to par_level
    sku: item.id?.toString() // Use ID as SKU for now since SKU column is missing
  }));
};

export const createManagerOrder = async (orderPayload: Record<string, any>) => {
  // Try to insert into supplier_orders table
  const { data, error } = await supabase
    .from('supplier_orders')
    .insert([orderPayload])
    .select();

  if (error) {
    console.error('Supabase createManagerOrder error:', error);
    // Fallback or re-throw? Let's rethrow so the UI knows.
    throw error;
  }
  return data?.[0];
};

export const updateManagerOrder = async (id: string | number, payload: Record<string, any>) => {
  const { data, error } = await supabase
    .from('supplier_orders')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data?.[0];
};

export const MANAGER_API_BASE = API_BASE_URL;

export const updateInventoryStock = async (itemId: string | number, newStock: number) => {
  // 'last_restoc_date' column was not found in schema scan, so we omit it.
  const { data } = await supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', itemId)
    .select();

  return data?.[0];
};

export const generateImageWithAI = async (prompt: string, style: string) => {
  const response = await fetch(buildUrl('/generate-image'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ prompt, style }),
  });
  return handleJson<{ imageUrl: string }>(response);
};
