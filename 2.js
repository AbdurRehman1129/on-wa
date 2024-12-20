const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');

// Connect to WhatsApp
async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        version: version,
    });

    sock.ev.process(async events => {
        if (events['connection.update']) {
            const { connection, lastDisconnect } = events['connection.update'];
            if (connection === 'close') {
                const isLoggedOut = lastDisconnect?.error?.output?.statusCode === 401; // Handle logout explicitly
                if (isLoggedOut) {
                    console.log('Logged out. Please delete the auth folder and re-run the script.');
                    process.exit(1);
                }
                const shouldReconnect = !isLoggedOut;
                if (shouldReconnect) {
                    console.log('Reconnecting...');
                    await connectWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('WhatsApp connected!');
            }
        }
        if (events['creds.update']) {
            await saveCreds();
        }
    });

    // Handle incoming messages and process commands
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        const sender = msg.key.remoteJid;
        const messageContent = msg.message.conversation;

        if (messageContent.startsWith('.check')) {
            const numbers = messageContent.split(' ')[1].split(',');
            await checkWhatsAppStatus(sock, sender, numbers);
        }
    });
}

// Function to check WhatsApp registration status
async function checkWhatsAppStatus(sock, sender, numbers) {
    let resultSummary = 'List of Numbers Checked:\n';
    let registeredCount = 0;
    let notRegisteredCount = 0;

    for (const num of numbers) {
        try {
            const isRegistered = await sock.onWhatsApp(num + '@s.whatsapp.net');
            const statusMessage = isRegistered.length > 0
                ? `${num} is registered on WhatsApp.`
                : `${num} is NOT registered on WhatsApp.`;
            resultSummary += `${statusMessage}\n`;
            if (isRegistered.length > 0) {
                registeredCount++;
            } else {
                notRegisteredCount++;
            }
        } catch (err) {
            resultSummary += `Error checking ${num}: ${err}\n`;
        }
    }

    const summary = `
Summary:
Registered: ${registeredCount}
Not Registered: ${notRegisteredCount}`;
    resultSummary += summary;

    // Send the result to the user
    await sock.sendMessage(sender, { text: resultSummary });
}

// Start the script
(async () => {
    console.log('Initializing WhatsApp connection...');
    await connectWhatsApp();
})();
