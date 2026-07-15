import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';
import { useAuth } from '@/context/AuthContext';

export const useOrderPush = () => {
    // Pure Direct-to-Server Writes: background sync disabled.
    return null;
};
