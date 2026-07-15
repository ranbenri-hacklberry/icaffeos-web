import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const GoogleCallback: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, isLoading } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        // Wait for auth context to finish loading
        if (isLoading) {
            console.log('⏳ Waiting for auth context to load...');
            return;
        }

        const handleCallback = async () => {
            const searchParams = new URLSearchParams(location.search);
            const code = searchParams.get('code');

            if (!code) {
                setStatus('error');
                return;
            }

            // Prevent double execution for the SAME code (React 18 Strict Mode)
            const processedKey = `google_code_processed_${code.substring(0, 20)}`;
            if (sessionStorage.getItem(processedKey) === 'success') {
                console.log('⏭️ Code already successfully processed, skipping...');
                setStatus('success');
                setTimeout(() => navigate('/owner-settings'), 1000);
                return;
            }

            // Get business context - try currentUser first, fallback to localStorage directly
            let businessId = currentUser?.business_id;
            let userEmail = currentUser?.email;

            if (!businessId) {
                try {
                    const storedUser = localStorage.getItem('kiosk_user');
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        businessId = parsed.business_id;
                        userEmail = parsed.email;
                        console.log('📦 Loaded context from localStorage:', { businessId, userEmail });
                    }
                } catch (e) {
                    console.warn('Failed to parse stored user:', e);
                }
            }

            if (!businessId) {
                console.error('❌ No business_id available!');
                setStatus('error');
                return;
            }

            try {
                console.log('🔄 Exchanging code for tokens...', { businessId, userEmail });

                const { data, error } = await supabase.functions.invoke('google-auth', {
                    body: {
                        action: 'exchange',
                        code,
                        business_id: businessId,
                        user_email: userEmail || 'owner@icaffeos.com'
                    }
                });

                if (error) {
                    console.error('Function error:', error);
                    // Try to read the actual error body
                    if (error.context && error.context instanceof Response) {
                        const errorBody = await error.context.json().catch(() => null);
                        console.error('🔴 Detailed error from server:', errorBody);
                    }
                    throw error;
                }

                console.log('✅ Token exchange successful:', data);

                // Mark as successfully processed to prevent duplicate calls
                sessionStorage.setItem(processedKey, 'success');

                setStatus('success');
                setTimeout(() => {
                    navigate('/owner-settings');
                }, 2000);

            } catch (err: any) {
                console.error('Error exchanging code:', err);
                console.error('Error details:', err?.message);
                // Try to get more details
                if (err.context && typeof err.context.json === 'function') {
                    try {
                        const body = await err.context.json();
                        console.error('🔴 Server returned:', body);
                    } catch (e) {
                        console.error('Could not parse error body');
                    }
                }
                setStatus('error');
            }
        };

        handleCallback();
    }, [location, navigate, currentUser, isLoading]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-sm w-full mx-4">
                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <Loader2 className="w-12 h-12 text-blue-500" />
                        </motion.div>
                        <p className="text-gray-600 font-medium">Connecting to Google...</p>
                    </div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                        <h2 className="text-2xl font-bold text-gray-800">Success!</h2>
                        <p className="text-gray-600">Gemini is now connected.</p>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <XCircle className="w-16 h-16 text-red-500" />
                        <h2 className="text-2xl font-bold text-gray-800">Connection Failed</h2>
                        <p className="text-gray-600">Oops, something went wrong. Please try again.</p>
                        <button
                            onClick={() => navigate('/data-manager-interface')}
                            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default GoogleCallback;
