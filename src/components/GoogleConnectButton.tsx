import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

const GoogleConnectButton: React.FC = () => {
    const { currentUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleConnect = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase.functions.invoke('google-auth', {
                body: {
                    action: 'get_url',
                    // Use dynamic context from the authenticated user
                    business_id: currentUser?.business_id,
                    user_email: currentUser?.email || 'owner@icaffeos.com' // Fallback for safety
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            console.error('Error initiating Google connection:', error);
            const msg = error?.message || error?.error_description || JSON.stringify(error);
            alert(`Failed to connect to Google: ${msg}. \n\nDid you deploy the function and set secrets?`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnect}
            disabled={isLoading}
            className="flex items-center gap-3 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
            )}
            <span>Connect Business Account</span>
        </motion.button>
    );
};

export default GoogleConnectButton;
