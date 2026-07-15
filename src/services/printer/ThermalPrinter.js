import { SerialPort } from 'serialport';
import { ThermalPrinter as NodeThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';

// Configuration
// Using /dev/tty.* is clearer for bidirectional, but cu.* is also fine.
// standard is 9600 for these cheap units, but 115200 is possible.
// We will stick to 9600 which is safer, or maybe try 115200 again if 9600 fails.
const PRINTER_PORT = '/dev/cu.MP210';
const BAUD_RATE = 9600;

export const ThermalPrinter = {
    printReceipt: (order) => {
        return new Promise((resolve, reject) => {
            // 1. Generate Buffer
            const printer = new NodeThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: 'printer',
                characterSet: CharacterSet.PC862_HEBREW,
                removeSpecialCharacters: false,
                lineCharacter: "=",
            });

            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println(order.businessName || "iCaffeOS");
            printer.setTextNormal();
            printer.drawLine();

            // ... Items ...
            if (order.items) {
                order.items.forEach(item => {
                    printer.println(`${item.name} ${item.price}`);
                });
            }
            printer.drawLine();
            printer.println(`TOTAL: ${order.total}`);
            printer.println("\n\n\n");
            printer.cut();

            const dataBuffer = printer.getBuffer();

            // 2. Open Serial Port
            const port = new SerialPort({
                path: PRINTER_PORT,
                baudRate: BAUD_RATE,
                autoOpen: false
            });

            port.open((err) => {
                if (err) {
                    console.error('❌ Error opening port:', err.message);
                    return reject(err);
                }

                // 3. CRITICAL: Set Control Signals to WAKE UP printer
                // Many generic printers ignore data unless DTR (Data Terminal Ready) is high.
                port.set({ dtr: true, rts: true }, (err) => {
                    if (err) console.warn('Warning setting DTR/RTS:', err.message);

                    // Small delay to let printer wake
                    setTimeout(() => {
                        port.write(dataBuffer, (err) => {
                            if (err) {
                                console.error('❌ Write error:', err.message);
                                return reject(err);
                            }

                            port.drain(() => {
                                console.log('✅ Data flushed.');
                                // Close after 1s
                                setTimeout(() => {
                                    port.close();
                                    resolve(true);
                                }, 1000);
                            });
                        });
                    }, 200);
                });
            });

            port.on('error', (err) => reject(err));
        });
    }
};
