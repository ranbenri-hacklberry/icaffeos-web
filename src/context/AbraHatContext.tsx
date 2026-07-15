import React, { createContext, useContext, useState } from 'react';
import { ICaffeSDK, AbraManifesto } from '../types/AbraTypes';

interface AbraHatContextType {
    isWearingHat: boolean; // Are we in sandbox mode?
    currentSpell: AbraManifesto | null;
    sdk: ICaffeSDK; // The Magic SDK (mocked if wearing hat)
    wearHat: (spell: AbraManifesto, isolatedData?: any) => void;
    takeOffHat: () => void;
    inspectorActive: boolean; // New: Is Edit/Inspector mode active?
    toggleInspector: () => void;
}

const AbraHatContext = createContext<AbraHatContextType | undefined>(undefined);

export const AbraHatProvider: React.FC<{ children: React.ReactNode, realSDK: ICaffeSDK }> = ({ children, realSDK }) => {
    const [currentSpell, setCurrentSpell] = useState<AbraManifesto | null>(null);
    const [mockSDK, setMockSDK] = useState<ICaffeSDK | null>(null);

    const wearHat = (spell: AbraManifesto, isolatedData?: any) => {
        // Gates (V-003): Manager+ required for Sandbox (8)
        realSDK.auth.identify().then(profile => {
            if (profile.access_level < 8) {
                console.error(`🚫 Spell Refused: [${profile.name}] lacks magical rank (${profile.access_level} < 8)`);
                alert('You lack the magical rank to cast this spell (Access Level 8+ required).');
                return;
            }
            console.log('🎩 Putting on the Abra Hat:', spell.spell_id);
            setCurrentSpell(spell);

            if (isolatedData) {
                console.log('🧊 Isolated Mode: Using data snapshot.');
                // Create a mock SDK that returns the isolated data for orders
                const snapshotSDK = {
                    ...realSDK,
                    db: {
                        ...realSDK.db,
                        getOrders: () => Promise.resolve(isolatedData),
                        // Override other methods if needed
                    }
                } as ICaffeSDK;
                setMockSDK(snapshotSDK);
            } else {
                setMockSDK(realSDK);
            }
        });
    };

    const takeOffHat = () => {
        console.log('🎩 Taking off the Abra Hat');
        setCurrentSpell(null);
        setMockSDK(null);
    };

    const [inspectorActive, setInspectorActive] = useState(false);

    const toggleInspector = () => setInspectorActive(prev => !prev);

    return (
        <AbraHatContext.Provider value={{
            isWearingHat: !!currentSpell,
            currentSpell,
            sdk: mockSDK || realSDK,
            wearHat,
            takeOffHat,
            inspectorActive,
            toggleInspector
        }}>
            {children}
        </AbraHatContext.Provider>
    );
};

export const useAbraHat = () => {
    const context = useContext(AbraHatContext);
    if (!context) {
        throw new Error('useAbraHat must be used within an AbraHatProvider');
    }
    return context;
};

// Hook to access the SDK (returns real or mock depending on context)
export const useMagicSDK = () => {
    return useAbraHat().sdk;
};
