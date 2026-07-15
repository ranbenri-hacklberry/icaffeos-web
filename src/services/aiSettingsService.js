
import { supabase } from '@/lib/supabase';

export const fetchAISettings = async (businessId) => {
    if (!businessId) return null;

    try {
        const { data, error } = await supabase
            .from('business_ai_settings')
            .select('*')
            .eq('business_id', businessId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error fetching AI settings:', error);
            return null;
        }

        return data; // returns { ai_prompt_template, generation_timeout_seconds, ... }
    } catch (err) {
        console.error('Failed to fetch AI settings:', err);
        return null;
    }
};

export const fetchBusinessSeeds = async (businessId) => {
    if (!businessId) return null;

    try {
        // Try to get from businesses table as per migration 20260120
        const { data, error } = await supabase
            .from('businesses')
            .select('container_seeds')
            .eq('id', businessId)
            .single();

        if (error) {
            console.error('Error fetching business seeds:', error);
            return [];
        }

        return data.container_seeds || [];
    } catch (err) {
        console.error('Failed to fetch business seeds:', err);
        return [];
    }
};

export const saveBusinessSeed = async (businessId, newSeed) => {
    if (!businessId) return false;

    try {
        // 1. Get current seeds
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('container_seeds')
            .eq('id', businessId)
            .single();

        if (fetchError) throw fetchError;

        const currentSeeds = business.container_seeds || [];
        const updatedSeeds = [...currentSeeds, newSeed];

        // 2. Update column
        const { error: updateError } = await supabase
            .from('businesses')
            .update({ container_seeds: updatedSeeds })
            .eq('id', businessId);

        if (updateError) throw updateError;

        return true;
    } catch (err) {
        console.error('Failed to save business seed:', err);
        return false;
    }
};

export const deleteBusinessSeed = async (businessId, seedId) => {
    if (!businessId) return false;

    try {
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('container_seeds')
            .eq('id', businessId)
            .single();

        if (fetchError) throw fetchError;

        const currentSeeds = business.container_seeds || [];
        const updatedSeeds = currentSeeds.filter(s => s.id !== seedId);

        const { error: updateError } = await supabase
            .from('businesses')
            .update({ container_seeds: updatedSeeds })
            .eq('id', businessId);

        if (updateError) throw updateError;

        return true;
    } catch (err) {
        console.error('Failed to delete business seed:', err);
        return false;
    }
};
