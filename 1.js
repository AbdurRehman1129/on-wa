const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const chalk = require('chalk');
const figlet = require('figlet');

// Clear the terminal screen (cross-platform compatibility)
function clearScreen() {
    console.clear();
    process.stdout.write('\x1Bc');
}

// Display banner
function displayBanner() {
    const bannerText = figlet.textSync('DARK DEVIL', { font: 'small' });
    clearScreen();
    const terminalWidth = process.stdout.columns || 80;

    const centeredBanner = bannerText.split('\n').map(line => line.padStart((terminalWidth + line.length) / 2).padEnd(terminalWidth)).join('\n');
    console.log(chalk.cyan(centeredBanner));

    const authorLine = chalk.green('Author/Github: @AbdurRehman1129');
    console.log(authorLine.padStart((terminalWidth + authorLine.length) / 2).padEnd(terminalWidth));
}

// Initialize WhatsApp client using baileys
const store = {};
const settingsFile = 'settings.json';
let userPhoneNumber = '';

if (fs.existsSync(settingsFile)) {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    userPhoneNumber = settings.phoneNumber || '';
}

const { state, saveCreds } = await useMultiFileAuthState('auth');
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    version: version,
    getMessage: key => store[key.id]?.message
});

sock.ev.process(async events => {
    if (events['connection.update']) {
        const { connection, lastDisconnect } = events['connection.update'];
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectWhatsApp();
            } else {
                console.log("Disconnected because you have logged out.");
            }
        }
    }
    if (events['creds.update']) {
        await saveCreds();
    }
    if (events['messages.upsert']) {
        const { messages } = events['messages.upsert'];
        messages.forEach(message => {
            console.log(message);
        });
    }
});

// Function to handle WhatsApp menu
function displayMenu() {
    clearScreen();
    displayBanner();
    const menu = `
-----------------------------------------
        WhatsApp Number Checker
-----------------------------------------
1. Check WhatsApp Registration Status
2. Set or Change Personal WhatsApp Number
3. Exit
-----------------------------------------`;

    console.log(chalk.yellow(menu));

    process.stdout.write('Enter your choice: ');
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (choice) => {
        choice = choice.trim();
        switch (choice) {
            case '1':
                checkWhatsAppStatus();
                break;
            case '2':
                setPersonalNumber();
                break;
            case '3':
                console.log('Exiting...');
                process.exit(0);
                break;
            default:
                console.log(chalk.red('Invalid choice, please select again.'));
                displayMenu();
                break;
        }
    });
}

// Function to set or change personal number
function setPersonalNumber() {
    process.stdout.write('Enter your personal WhatsApp number (with country code): ');
    process.stdin.once('data', (number) => {
        userPhoneNumber = number.trim();
        fs.writeFileSync(settingsFile, JSON.stringify({ phoneNumber: userPhoneNumber }), 'utf-8');
        console.log(chalk.green('Your personal WhatsApp number has been saved.'));
        promptReturnToMenu();
    });
}

// Function to check WhatsApp registration status
async function checkWhatsAppStatus() {
    process.stdout.write('Enter phone numbers with country code (comma-separated), or type "exit" to quit: ');

    process.stdin.once('data', async (input) => {
        input = input.trim();
        if (input.toLowerCase() === 'exit') {
            console.log('Exiting...');
            process.exit(0);
        } else {
            const numbers = input.split(',').map(num => num.trim());
            let registeredCount = 0;
            let notRegisteredCount = 0;
            let resultSummary = `List of Numbers Checked:\n`;

            for (const num of numbers) {
                try {
                    const isRegistered = await sock.isRegisteredUser(num);
                    const statusMessage = isRegistered ? `${num} is registered on WhatsApp.` : `${num} is NOT registered on WhatsApp.`;
                    resultSummary += `${statusMessage}\n`;

                    if (isRegistered) {
                        registeredCount++;
                    } else {
                        notRegisteredCount++;
                    }
                } catch (err) {
                    resultSummary += `Error checking ${num}: ${err}\n`;
                    console.log(chalk.red(`Error checking number ${num}:`, err));
                }
            }

            const summary = `
Summary:
Registered: ${registeredCount}
Not Registered: ${notRegisteredCount}`;

            resultSummary += summary;
            console.log(chalk.yellow(resultSummary));

            if (userPhoneNumber) {
                try {
                    await sock.sendMessage(userPhoneNumber + '@c.us', resultSummary);
                    console.log(chalk.green('Summary sent to your WhatsApp.'));
                } catch (err) {
                    console.log(chalk.red('Failed to send summary to WhatsApp:', err));
                }
            } else {
                console.log(chalk.red('Personal WhatsApp number is not set. Please set it in the menu.'));
            }

            promptReturnToMenu();
        }
    });
}

// Helper function to prompt user to return to menu
function promptReturnToMenu() {
    process.stdout.write('Enter "m" to return to the main menu: ');
    process.stdin.once('data', (input) => {
        input = input.trim().toLowerCase();
        if (input === 'm') {
            displayMenu();
        } else {
            console.log(chalk.red('Invalid input, returning to the main menu.'));
            displayMenu();
        }
    });
}

// Initializing connection to WhatsApp
async function connectWhatsApp() {
    sock.ev.process(async events => {
        if (events['connection.update']) {
            const { connection, lastDisconnect } = events['connection.update'];
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    connectWhatsApp();
                } else {
                    console.log("Disconnected because you have logged out.");
                }
            }
        }
        if (events['creds.update']) {
            await saveCreds();
        }
        if (events['messages.upsert']) {
            const { messages } = events['messages.upsert'];
            messages.forEach(message => {
                console.log(message);
            });
        }
    });
}

displayMenu();
