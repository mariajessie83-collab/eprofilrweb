var bluetoothPrinter = (function () {
    let printDevice = null;
    let printCharacteristic = null;

    // Standard UUIDs for Bluetooth Serial Port Profile (SPP) / Thermal Printers
    // 000018f0-0000-1000-8000-00805f9b34fb is the standard 16-bit Service UUID for "Printing Service" commonly used.
    // However, many generic Chinese printers use specific custom UUIDs.
    // We will scan for a broader range or generic access.
    const serviceUUID = "000018f0-0000-1000-8000-00805f9b34fb";
    const characteristicUUID = "00002af1-0000-1000-8000-00805f9b34fb";

    // Alternative: Generic Serial (many printers use this if they don't advertise "Printer")
    // const serialServiceUUID = 0xFF00; // Example

    // For now, we will filter by "printer" services if possible, or accept all devices to let user pick.
    // Accepting all devices is safer for compatibility with generic "MTP-2" or "POS-58" printers.

    async function printTicket(referenceNumber, details) {
        try {
            console.log("Starting print job for: " + referenceNumber);

            // 1. Ensure connected
            if (!printDevice || !printDevice.gatt.connected) {
                await connectPrinter();
            }

            if (!printCharacteristic) {
                throw new Error("Printer connected but characteristic not found.");
            }

            // 2. Prepare Data (ESC/POS Commands)
            const commands = generateTicketCommands(referenceNumber, details);

            // 3. Send Data (Chunking might be needed for large data, but ticket is small)
            await printCharacteristic.writeValue(commands);
            console.log("Print job sent successfully.");
            return true;
        } catch (error) {
            console.error("Printing failed:", error);
            // Attempt to reset connection for next time
            printDevice = null;
            printCharacteristic = null;
            throw error;
        }
    }

    async function connectPrinter() {
        // 1. Try to reconnect to existing object if we have it
        if (printDevice) {
            console.log("Attempting to reconnect to existing device...");
            try {
                if (!printDevice.gatt.connected) {
                    await printDevice.gatt.connect();
                    console.log("Reconnected successfully!");
                }
                // Determine characteristic again just in case
                const server = printDevice.gatt;
                const service = await server.getPrimaryService(serviceUUID);
                printCharacteristic = await service.getCharacteristic(characteristicUUID);
                return;
            } catch (err) {
                console.warn("Reconnection failed, retrying discovery...", err);
                printDevice = null; // Reset to force full discovery
            }
        }

        // 2. Try to find allowed devices (Persisted permissions)
        let device = null;
        if (navigator.bluetooth.getDevices) {
            console.log("Checking for known devices...");
            const devices = await navigator.bluetooth.getDevices();
            if (devices.length > 0) {
                console.log("Found known devices:", devices);
                device = devices[0];
                await device.watchAdvertisements();
            }
        }

        // 3. User Gesture - Request Device
        if (!device) {
            console.log("Requesting new device...");
            // Use acceptAllDevices to robustly handle any printer type
            device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [serviceUUID]
            });
        }

        // Connect GATT
        const server = await device.gatt.connect();
        printDevice = device;

        // Handle disconnects
        device.addEventListener('gattserverdisconnected', onDisconnected);

        // Get Service & Characteristic
        const service = await server.getPrimaryService(serviceUUID);
        printCharacteristic = await service.getCharacteristic(characteristicUUID);

        console.log("Printer connected!");
    }

    function onDisconnected() {
        console.log("Printer disconnected");
        // We generally don't auto-reconnect immediately to avoid loops, 
        // we just let the next 'printTicket' call handle it.
    }

    function generateTicketCommands(refNum, details) {
        // ESC/POS Command Helpers
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;

        // Helper to convert string to byte array
        const encoder = new TextEncoder();

        let commandBuffers = [];

        // 1. Initialize
        commandBuffers.push(new Uint8Array([ESC, 0x40]));

        // 2. Center Align
        commandBuffers.push(new Uint8Array([ESC, 0x61, 1]));

        // 3. Title (Double Height/Width) -> GS ! 0x11 (17 decimal) = Double Width & Height
        commandBuffers.push(new Uint8Array([GS, 0x21, 0x11]));
        commandBuffers.push(encoder.encode("ePROFILR\n"));
        commandBuffers.push(new Uint8Array([GS, 0x21, 0x00])); // Reset size
        commandBuffers.push(encoder.encode("Student Profiling System\n\n"));

        // 4. Reference Number (Large, Bold)
        commandBuffers.push(encoder.encode("Reference Number:\n"));
        commandBuffers.push(new Uint8Array([ESC, 0x45, 1])); // Bold On
        // REMOVED Double Size for Label to fit 58mm (32 chars max)
        // commandBuffers.push(new Uint8Array([GS, 0x21, 0x11])); 

        // Print Reference Number Value (Double Height only for better fit?) 
        // 0x01 = Double Height, 0x10 = Double Width, 0x11 = Both
        // Let's keep Both for the number itself, hoping it is < 16 chars.
        commandBuffers.push(new Uint8Array([GS, 0x21, 0x11]));
        commandBuffers.push(encoder.encode(refNum + "\n"));
        commandBuffers.push(new Uint8Array([GS, 0x21, 0x00])); // Reset size
        commandBuffers.push(new Uint8Array([ESC, 0x45, 0])); // Bold Off
        commandBuffers.push(new Uint8Array([LF]));

        // 5. Details
        commandBuffers.push(new Uint8Array([ESC, 0x61, 0])); // Left Align
        commandBuffers.push(encoder.encode("Date: " + details.date + "\n"));
        commandBuffers.push(encoder.encode("Time: " + details.time + "\n"));
        commandBuffers.push(encoder.encode("Type: " + details.type + "\n"));
        if (details.complainant) commandBuffers.push(encoder.encode("Reported by: " + details.complainant + "\n"));
        commandBuffers.push(new Uint8Array([LF]));

        // 6. Footer
        commandBuffers.push(new Uint8Array([ESC, 0x61, 1])); // Center
        commandBuffers.push(encoder.encode("Please keep this slip\nfor your reference.\n"));
        commandBuffers.push(new Uint8Array([LF, LF, LF]));

        // 7. Cut Paper (GS V m) -> GS V 66 0
        // commandBuffers.push(new Uint8Array([GS, 0x56, 66, 0])); // Full cut feeding paper
        // Assuming printer supports cut, or at least feed plenty of lines

        // Flatten buffers
        let totalLength = commandBuffers.reduce((acc, buf) => acc + buf.length, 0);
        let finalBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (let buf of commandBuffers) {
            finalBuffer.set(buf, offset);
            offset += buf.length;
        }

        return finalBuffer;
    }

    return {
        printTicket: printTicket
    };
})();
