const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');

// Variables
let personalNumber = '';  // To store user's personal phone number

// Command processing
async function processCommands(sock, sender, messageContent) {
    const [command, ...args] = messageContent.split(' ');

    switch (command.toLowerCase()) {
        case '.menu':
            const menu = `
Available Commands:
1. .check <num1,num2,...> - Check WhatsApp registration status of numbers.
2. .setNum <phone_number> - Set your personal phone number for notifications.
3. .summary - Get the summary (will send to personal phone if set).
`;
            await sock.sendMessage(sender, { text: menu });
            break;
        
        case '.check':
            const numbers = args[0]?.split(',') || [];
            if (numbers.length === 0) {
                await sock.sendMessage(sender, { text: 'Please provide numbers to check. Example: .check 1234567890,9876543210' });
                return;
            }

            let summary = 'Check Results:\n';
            for (const number of numbers) {
                try {
                    const isRegistered = await sock.queryExists(number + '@s.whatsapp.net');
                    summary += `${number}: ${isRegistered ? 'Registered' : 'Not Registered'}\n`;
                } catch (error) {
                    summary += `${number}: Error checking registration\n`;
                }
            }

            await sock.sendMessage(sender, { text: summary });
            break;

        case '.setnum':
            const newNumber = args[0];
            if (!newNumber) {
                await sock.sendMessage(sender, { text: 'Please provide a phone number to set. Example: .setNum 923145151029' });
                return;
            }
            personalNumber = newNumber;
            await sock.sendMessage(sender, { text: `Your personal number has been set to ${personalNumber}.` });
            break;

        case '.summary':
            if (!personalNumber) {
                await sock.sendMessage(sender, { text: 'You have not set a personal phone number. Use .setNum to set it.' });
            } else {
                await sock.sendMessage(sender, { text: `Summary will be sent to your personal number: ${personalNumber}.` });
                // You can send more detailed summaries or results here.
            }
            break;

        default:
            await sock.sendMessage(sender, { text: 'Unknown command. Type .menu for available commands.' });
    }
}

async function connectWhatsAppBot() {
    // Authentication
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,  // Display QR code in terminal
    });

    sock.ev.process(async (events) => {
        if (events['connection.update']) {
            const { connection, lastDisconnect } = events['connection.update'];
            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectWhatsAppBot(); // Reconnect if not logged out
            }
        }

        if (events['messages.upsert']) {
            const { messages } = events['messages.upsert'];
            for (const msg of messages) {
                const sender = msg.key.remoteJid; // Sender's WhatsApp ID
                const messageContent = msg.message?.conversation || '';
                console.log(`Message from ${sender}: ${messageContent}`);

                if (messageContent) {
                    await processCommands(sock, sender, messageContent);
                }
            }
        }
    });
}

connectWhatsAppBot();
