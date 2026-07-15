import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useRatings = () => {
    const { currentUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);





    // useRatings is now only used for playlist generation
    return {
        generateSmartPlaylist: () => ({ success: false, message: 'Moved to useAlbums' })
    };
};

export default useRatings;
