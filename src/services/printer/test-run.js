import { ThermalPrinter } from '@/services/printer/ThermalPrinter.js';

const mockOrder = {
    id: 'TEST-DTR-01',
    businessName: 'Cafe Dev Test',
    items: [
        { name: 'Cappuccino L', price: 16.00 },
        { name: 'Butter Croissant', price: 18.00 },
        { name: 'Orange Juice', price: 14.00 }
    ],
    total: 48.00
};

console.log('------------------------------------------------');
console.log('🖨️  Starting Thermal Printer Test (DTR/RTS Mode)');
console.log('------------------------------------------------');
console.log('Target Device: /dev/cu.MP210');
console.log('Baud Rate: 9600 (Standard)');
console.log('Signals: DTR=true, RTS=true (Wake up)');
console.log('------------------------------------------------');
console.log('Spooling job...');

(async () => {
    try {
        const result = await ThermalPrinter.printReceipt(mockOrder);
        if (result) {
            console.log('------------------------------------------------');
            console.log('✅ TEST PASSED: Data flushed to serial port.');
            console.log('👀 CHECK PRINTER NOW.');
            console.log('------------------------------------------------');
        }
    } catch (error) {
        console.log('------------------------------------------------');
        console.log('❌ TEST FAILED');
        console.error(error.message);
        console.log('------------------------------------------------');
        process.exit(1);
    }
})();
