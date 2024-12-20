const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const figlet = require('figlet');
const fs = require('fs');
const readline = require('readline');

// Set up readline interface to read input from the terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Initialize WhatsApp socket
const { state, saveCreds } = await useMultiFileAuthState('auth');
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state
});

// Global variable to store user's personal WhatsApp number
let personalNumber = '';

// Display banner
function displayBanner() {
    figlet.text('WhatsApp Bot', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
        width: 80,
        whitespaceBreak: true
    }, function(err, data) {
        if (err) {
            console.log('Error in figlet: ', err);
            return;
        }
        console.log(data);
    });
}

// Display main menu
async function displayMenu() {
    console.clear();
    displayBanner();
    console.log('-----------------------------------------');
    console.log('        WhatsApp Utility Menu');
    console.log('-----------------------------------------');
    console.log('1. Check WhatsApp Registration Status');
    console.log('2. Set or Change Personal WhatsApp Number');
    console.log('3. Exit');
    console.log('-----------------------------------------');
    rl.question('Enter your choice: ', async (choice) => {
        switch (choice) {
            case '1':
                await checkWhatsAppRegistration();
                break;
            case '2':
                await setPersonalNumber();
                break;
            case '3':
                console.log('Exiting...');
                process.exit(0);
                break;
            default:
                console.log('Invalid choice, try again.');
                await displayMenu();
        }
    });
}

// Check WhatsApp registration status
async function checkWhatsAppRegistration() {
    rl.question('Enter phone numbers with country code (comma-separated), or type "exit" to quit: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
            await displayMenu();
            return;
        }

        const numbers = input.split(',').map(num => num.trim());
        let summary = 'Check Results:\n';

        for (const number of numbers) {
            const isRegistered = await sock.queryExists(number + '@s.whatsapp.net');
            summary += `${number}: ${isRegistered ? 'Registered' : 'Not Registered'}\n`;
        }

        if (personalNumber) {
            await sock.sendMessage(personalNumber + '@s.whatsapp.net', { text: summary });
            console.log(`Summary sent to your personal number: ${personalNumber}`);
        }

        console.log(summary);
        await displayMenu();
    });
}

// Set or change personal WhatsApp number
async function setPersonalNumber() {
    rl.question('Enter your personal WhatsApp number (with country code): ', async (input) => {
        personalNumber = input.trim();
        console.log(`Your personal WhatsApp number has been saved: ${personalNumber}`);
        console.log('Press Enter to return to the menu...');
        rl.once('data', async () => await displayMenu());
    });
}

// Process incoming messages for commands
sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];
    const sender = message.key.remoteJid;

    if (!message.message) return;

    const text = message.message.conversation || '';

    if (text.startsWith('.menu')) {
        await displayMenu();
    } else if (text.startsWith('.check')) {
        const numbers = text.split(' ').slice(1);
        if (numbers.length > 0) {
            let summary = 'Check Results:\n';
            for (const number of numbers) {
                const isRegistered = await sock.queryExists(number + '@s.whatsapp.net');
                summary += `${number}: ${isRegistered ? 'Registered' : 'Not Registered'}\n`;
            }
            if (personalNumber) {
                await sock.sendMessage(sender, { text: summary });
            } else {
                await sock.sendMessage(sender, { text: summary });
            }
        }
    } else if (text.startsWith('.setNum')) {
        const newNumber = text.split(' ')[1];
        if (newNumber) {
            personalNumber = newNumber;
            await sock.sendMessage(sender, { text: `Your personal WhatsApp number has been set to: ${personalNumber}` });
        } else {
            await sock.sendMessage(sender, { text: 'Please provide a phone number after the command, e.g., .setNum <phone_number>' });
        }
    }
});

// Start the WhatsApp bot
console.log('Starting WhatsApp bot...');
await displayMenu();
