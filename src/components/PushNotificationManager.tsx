import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export const PushNotificationManager: React.FC = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser?.id || !Capacitor.isNativePlatform()) {
      return;
    }

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive !== 'granted') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          // Register with Apple/Google push services
          await PushNotifications.register();
        } else {
          console.warn('⚠️ Push notification permissions denied');
        }
      } catch (err) {
        console.error('❌ Failed to request push permissions:', err);
      }
    };

    // Add push listeners
    const addListeners = async () => {
      await PushNotifications.addListener('registration', async (token) => {
        console.log(`📱 FCM Device Token Registered: ${token.value}`);
        
        try {
          // Update the global user profile with the hardware FCM token
          const { error } = await supabase
            .from('profiles')
            .update({ 
              fcm_token: token.value,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

          if (error) {
            console.error('❌ Failed to update profiles table with FCM token:', error.message);
          } else {
            console.log('✅ Profiles table updated with FCM token successfully');
          }
        } catch (syncErr) {
          console.error('❌ Error syncing FCM token to central database:', syncErr);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error(`❌ Push registration error: ${JSON.stringify(error)}`);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log(`🔔 Push Notification received in foreground: ${JSON.stringify(notification)}`);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log(`🔔 Push Action Performed: ${JSON.stringify(notification)}`);
      });
    };

    registerPush();
    addListeners();

    // Clean up listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [currentUser?.id]);

  return null; // Behavior-only controller component
};

export default PushNotificationManager;
