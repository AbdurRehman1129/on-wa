const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');

// Clear the terminal screen
function clearScreen() {
    console.clear();
}

// Display banner
function displayBanner() {
    const fontPath = path.resolve(__dirname, 'node_modules/figlet/fonts/small.flf');
    if (!fs.existsSync(fontPath)) {
        console.log(chalk.red('Font file "small.flf" is missing. Using default font.'));
        figlet.defaults({ font: 'Standard' });
    } else {
        figlet.defaults({ font: 'small' });
    }
    const bannerText = figlet.textSync('DARK DEVIL');
    clearScreen();
    const terminalWidth = process.stdout.columns || 80;
    const centeredBanner = bannerText.split('\n')
        .map(line => line.padStart((terminalWidth + line.length) / 2).padEnd(terminalWidth))
        .join('\n');
    console.log(chalk.cyan(centeredBanner));
    const authorLine = chalk.green('Author/Github: @AbdurRehman1129');
    console.log(authorLine.padStart((terminalWidth + authorLine.length) / 2).padEnd(terminalWidth));
}

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
                    console.log(chalk.red('Logged out. Please delete the auth folder and re-run the script.'));
                    process.exit(1);
                }
                const shouldReconnect = !isLoggedOut;
                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting...'));
                    await connectWhatsApp();
                }
            } else if (connection === 'open') {
                console.log(chalk.green('WhatsApp connected!'));
                displayMenu(sock);
            }
        }
        if (events['creds.update']) {
            await saveCreds();
        }
    });
}

// Display menu
function displayMenu(sock) {
    clearScreen();
    displayBanner();
    const menu = `
-----------------------------------------
        WhatsApp Utility Menu
-----------------------------------------
1. Check WhatsApp Registration Status
2. Exit
-----------------------------------------`;

    console.log(chalk.yellow(menu));
    process.stdout.write('Enter your choice: ');

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async (choice) => {
        choice = choice.trim();
        switch (choice) {
            case '1':
                await checkWhatsAppStatus(sock);
                break;
            case '2':
                console.log('Exiting...');
                process.exit(0);
                break;
            default:
                console.log(chalk.red('Invalid choice, please select again.'));
                displayMenu(sock);
                break;
        }
    });
}

// Function to check WhatsApp registration status
async function checkWhatsAppStatus(sock) {
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
                    const isRegistered = await sock.onWhatsApp(num);
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
                    console.log(chalk.red(`Error checking number ${num}:`, err));
                }
            }

            const summary = `
Summary:
Registered: ${registeredCount}
Not Registered: ${notRegisteredCount}`;
            resultSummary += summary;
            console.log(chalk.yellow(resultSummary));
            process.stdout.write('Press Enter to return to the menu...');
            process.stdin.once('data', () => displayMenu(sock));
        }
    });
}

// Start the script
(async () => {
    displayBanner();
    console.log(chalk.green('Initializing WhatsApp connection...'));
    await connectWhatsApp();
})();
