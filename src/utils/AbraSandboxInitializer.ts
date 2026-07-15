import { db } from '../db/database';
import { AbraManifesto } from '../types/AbraTypes';

/**
 * AbraSandboxInitializer
 * Prepares the magical environment for spell testing.
 * Snapshot logic: V-002 (Isolated Mode)
 */
export const initializeDessertGlowSandbox = async (wearHat: (spell: AbraManifesto) => void) => {
    console.log('🔮 Preparing Dessert Glow Sandbox Snapshot...');

    // 1. Fetch real "new" orders from Dexie to act as a baseline
    const realOrders = await db.orders
        .where('order_status')
        .equals('pending')
        .limit(3)
        .toArray();

    // 2. Load the Manifesto
    const manifestoResponse = await fetch('/dessert-glow-manifesto.json');
    const manifesto: AbraManifesto = await manifestoResponse.json();

    // 3. Construct Magic Snapshot (Mock Data)
    // We add a "Fake Dessert" item to ensure the spell logic triggers
    const mockOrders = [
        ...realOrders,
        {
            id: 'mock-dessert-order-1',
            order_number: 'MAGIC-99',
            order_status: 'pending',
            customer_name: 'Sandbox Wizard',
            created_at: new Date(Date.now() - 7 * 60000).toISOString(), // 7 mins ago (Status: Critical)
            items: [
                {
                    id: 'item-1',
                    name: 'Chocolate Soufflé',
                    category: 'Dessert',
                    item_status: 'new',
                    quantity: 1
                },
                {
                    id: 'item-2',
                    name: 'Espresso',
                    category: 'Drinks',
                    item_status: 'new',
                    quantity: 1
                }
            ]
        }
    ];

    console.log('✨ Base data snapshot captured. Activating AbraHat...');

    // 4. Trigger the Hat (Logic Gate Level 8 is checked inside wearHat)
    wearHat(manifesto);

    // Note: In a full implementation, the MockSDK would be injected here 
    // and would return mockOrders instead of querying the real Dexie 'db'.
    return mockOrders;
};
