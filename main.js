const { Client, LocalAuth } = require('whatsapp-web.js');  
const fs = require('fs');
const chalk = require('chalk');
const figlet = require('figlet');

// Clear the terminal screen (using console.clear instead of \x1Bc for cross-terminal compatibility)
function clearScreen() {
    console.clear();
    process.stdout.write('\x1Bc');  // Reset screen
}

// Display banner
function displayBanner() {
    const bannerText = figlet.textSync('DARK DEVIL', { font: 'small' });
    clearScreen();
    const terminalWidth = process.stdout.columns || 80;  // Default width if terminal width is unavailable

    const centeredBanner = bannerText.split('\n').map(line => line.padStart((terminalWidth + line.length) / 2).padEnd(terminalWidth)).join('\n');
    console.log(chalk.cyan(centeredBanner));

    const authorLine = chalk.green('Author/Github: @AbdurRehman1129');
    console.log(authorLine.padStart((terminalWidth + authorLine.length) / 2).padEnd(terminalWidth));
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    restartOnAuthFail: true,
});

// Load user's personal WhatsApp number (from saved file)
const settingsFile = 'settings.json';
let userPhoneNumber = '';

if (fs.existsSync(settingsFile)) {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    userPhoneNumber = settings.phoneNumber || '';
}

client.on('ready', () => {
    console.log('Authenticated successfully!');
    console.log('Client is ready!');
    displayBanner();  // Display banner here
    displayMenu();
});

// Handle menu options
function displayMenu() {
    clearScreen();  // Clear the screen at the start of each menu display
    displayBanner();  // Show the banner again
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
        // Save the number to settings file
        fs.writeFileSync(settingsFile, JSON.stringify({ phoneNumber: userPhoneNumber }), 'utf-8');
        console.log(chalk.green('Your personal WhatsApp number has been saved.'));

        // Ask the user to enter something to go back to the main menu
        process.stdout.write('Enter anything to return to the main menu: ');
        process.stdin.once('data', (input) => {
            clearScreen();
            displayBanner();  // Display banner before the main menu
            displayMenu();
        });
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
                    const isRegistered = await client.isRegisteredUser(num);
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

            // Send the summary to the personal number, if set
            if (userPhoneNumber) {
                try {
                    await client.sendMessage(userPhoneNumber + '@c.us', resultSummary);
                    console.log(chalk.green('Summary sent to your WhatsApp.'));
                } catch (err) {
                    console.log(chalk.red('Failed to send summary to WhatsApp:', err));
                }
            } else {
                console.log(chalk.red('Personal WhatsApp number is not set. Please set it in the menu.'));
            }

            // Prompt to go back to the main menu
            process.stdout.write('Enter "m" to return to the main menu: ');
            process.stdin.once('data', (input) => {
                input = input.trim().toLowerCase();
                if (input === 'm') {
                    clearScreen();
                    displayBanner();  // Display banner before the main menu
                    displayMenu();
                } else {
                    console.log(chalk.red('Invalid input, returning to the main menu.'));
                    clearScreen();
                    displayBanner();  // Display banner before the main menu
                    displayMenu();
                }
            });
        }
    });
}

// Authentication and session handling
client.on('authenticated', () => {
    console.log('Authenticated successfully!');
});

client.on('disconnected', () => {
    console.log('Client was disconnected.');
    process.exit(1);
});

client.initialize();
