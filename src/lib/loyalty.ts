import { getSupabase } from '@/lib/supabase';

/**
 * Get loyalty balance for a customer
 * @param {string | null} customerPhone 
 * @param {object} user - Current logged in user (for schema context)
 * @returns {Promise<{points: number, freeCoffees: number}>}
 */
export async function getLoyaltyCount(customerPhone, user) {
  if (!customerPhone) return { points: 0, freeCoffees: 0 };

  const cleanPhone = customerPhone.replace(/\D/g, '');
  const businessId = user?.business_id;

  if (!businessId) {
    console.warn('⚠️ [Loyalty] Missing businessId in context');
    return { points: 0, freeCoffees: 0 };
  }

  try {
    const client = getSupabase(user);

    console.log(`🔍 [Loyalty] Fetching EXACT for: ${cleanPhone} in biz: ${businessId}`);

    // Call our NEW, non-conflicting RPC
    const { data, error } = await client.rpc('get_exact_loyalty_balance', {
      p_phone: cleanPhone,
      p_business_id: businessId
    });

    if (error) {
      console.warn(`⚠️ [Loyalty] RPC failed, falling back:`, error.message);

      const { data: directData, error: directError } = await client
        .from('loyalty_cards')
        .select('points_balance')
        .eq('customer_phone', cleanPhone)
        .eq('business_id', businessId)
        .maybeSingle();

      if (directError) throw directError;

      const points = directData?.points_balance ?? 0;
      return {
        points: points,
        freeCoffees: Math.floor(points / 10)
      };
    }

    // RPC returns TABLE, so data is an array
    const result = (Array.isArray(data) && data.length > 0) ? data[0] : (data || {});

    console.log(`✅ [Loyalty] Result for ${cleanPhone}:`, result);

    return {
      points: result.points ?? 0,
      freeCoffees: result.free_coffees ?? 0
    };
  } catch (error) {
    console.error('❌ [Loyalty] Failed to fetch count:', error);
    return { points: 0, freeCoffees: 0 };
  }
}

/**
 * Add points for a purchase
 * @param {string | null} customerPhone 
 * @param {string} orderId 
 * @param {number} itemsCount 
 * @param {object} user - Current logged in user (for schema context)
 * @param {number} redeemedCount - Number of free coffees redeemed
 * @returns {Promise<{success: boolean, newCount: number, addedPoints: number}>}
 */
export async function addCoffeePurchase(customerPhone, orderId, itemsCount = 1, user, redeemedCount = 0) {
  if (!customerPhone) {
    return { success: false, newCount: 0, addedPoints: 0 };
  }

  // 🔒 Client-side validation: Only allow Israeli mobile phones (05...)
  let cleanPhone = customerPhone.replace(/\D/g, '');

  // Normalize Israeli international format (9725...) -> (05...)
  if (cleanPhone.startsWith('9725')) {
    cleanPhone = '0' + cleanPhone.slice(3);
  }

  if (!cleanPhone.startsWith('05') || cleanPhone.length < 10) {
    console.warn('⚠️ [Loyalty] Invalid phone for loyalty (must be 05...):', cleanPhone);
    return { success: false, newCount: 0, addedPoints: 0, error: 'invalid_phone' };
  }

  try {
    const client = getSupabase(user);
    console.log('📞 [Loyalty] Calling handle_loyalty_purchase with:', { cleanPhone, orderId, itemsCount, redeemedCount, businessId: user?.business_id });
    const { data, error } = await client.rpc('handle_loyalty_purchase', {
      p_phone: cleanPhone, // FIX: Use cleaned phone, not original!
      p_order_id: orderId,
      p_items_count: itemsCount,
      p_redeemed_count: redeemedCount,
      p_business_id: user?.business_id // Pass business_id to fix multi-tenancy
    });

    if (error) throw error;

    // 🔥 IMMEDIATE LOCAL UPDATE - Update Dexie so data is available instantly
    if (data?.success && data?.card_id && user?.business_id) {
      try {
        const { db } = await import('@/db/database');
        const cleanPhone = customerPhone.replace(/\D/g, '');

        // Update or insert the loyalty card in Dexie
        await db.loyalty_cards.put({
          id: data.card_id,
          customer_phone: cleanPhone,
          business_id: user.business_id,
          points_balance: data.new_balance,
          total_coffees_purchased: (data.total_purchased || 0),
          last_updated: new Date().toISOString()
        });

        // Also add the transaction to Dexie
        if (orderId && itemsCount > 0) {
          await db.loyalty_transactions.put({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            card_id: data.card_id,
            order_id: orderId,
            business_id: user.business_id,
            change_amount: itemsCount,
            points_earned: itemsCount,
            points_redeemed: redeemedCount,
            transaction_type: 'purchase',
            created_at: new Date().toISOString()
          });
        }

        // [CLEANED] console.log('✅ [Loyalty] Local Dexie updated immediately:', { phone: cleanPhone, balance: data.new_balance });
      } catch (dexieError) {
        console.warn('⚠️ [Loyalty] Failed to update local Dexie (will sync later):', dexieError);
      }
    }

    return {
      success: data.success,
      newCount: data.new_balance,
      addedPoints: data.added_points
    };
  } catch (error) {
    console.error('Failed to update loyalty:', error);
    return { success: false, newCount: 0, addedPoints: 0 };
  }
}

/**
 * Handle loyalty adjustment for edit mode
 * @param {string} customerPhone 
 * @param {string} orderId 
 * @param {number} pointsDelta 
 * @param {object} user 
 * @param {number} redeemedDelta 
 * @returns {Promise<{success: boolean, newCount: number, addedPoints: number}>}
 */
export async function handleLoyaltyAdjustment(customerPhone, orderId, pointsDelta, user, redeemedDelta = 0) {
  if (!customerPhone) {
    return { success: false, newCount: 0, addedPoints: 0 };
  }

  try {
    const client = getSupabase(user);
    const { data, error } = await client.rpc('handle_loyalty_adjustment', {
      phone_number: customerPhone,
      order_id: orderId,
      points_delta: pointsDelta,
      current_user_id: null, // We don't have user ID in frontend context
      redeemed_delta: redeemedDelta
    });

    if (error) throw error;

    return {
      success: data?.success ?? false,
      newCount: data?.newPoints ?? 0,
      newFreeCoffees: data?.newFreeCoffees ?? 0
    };
  } catch (error) {
    console.error('Failed to adjust loyalty:', error);
    return { success: false, newCount: 0, addedPoints: 0 };
  }
}

/**
 * Get the number of coffees redeemed in a specific order
 * @param {string} orderId 
 * @param {object} user 
 * @returns {Promise<number>}
 */
export async function getLoyaltyRedemptionForOrder(orderId, user) {
  if (!orderId) return 0;

  try {
    const client = getSupabase(user);
    const { data, error } = await client
      .from('loyalty_transactions')
      .select('change_amount')
      .eq('order_id', orderId)
      .eq('transaction_type', 'redemption');

    if (error) throw error;

    // Sum up all redemptions (they are negative numbers, so we take abs)
    const totalPointsRedeemed = data.reduce((sum, tx) => sum + Math.abs(tx.change_amount), 0);
    return Math.floor(totalPointsRedeemed / 10);
  } catch (error) {
    console.error('Failed to fetch loyalty redemption:', error);
    return 0;
  }
}
