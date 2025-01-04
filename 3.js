const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const ytdl = require('ytdl-core');

// Logger configuration
const logger = P({ level: 'silent' }); // Suppress logs

// Load personal number from file (if exists)
const settingsFile = 'settings.json';
let userPhoneNumber = '';

if (fs.existsSync(settingsFile)) {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    userPhoneNumber = settings.phoneNumber || '';
}

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
        logger: logger, // Suppress logs
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
            }
        }
        if (events['creds.update']) {
            await saveCreds();
        }
    });

    // Start listening for messages from WhatsApp
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        const sender = message.key.remoteJid;

        if (message.message && message.message.conversation) {
            const text = message.message.conversation.trim();

            if (text.startsWith('.check')) {
                const phoneNumbers = text.replace('.check', '').trim();
                await checkWhatsAppStatus(sock, sender, phoneNumbers);
            } else if (text.startsWith('.video ')) {
                const videoURL = text.replace('.video', '').trim();
                await sendQualityOptions(sock, sender, videoURL);
            } else if (/^\d+p$/.test(text)) {
                const quality = text;
                const videoData = await handleQualityChoice(sender, quality);
                if (videoData) {
                    await sendVideo(sock, sender, videoData);
                }
            }
        }
    });
}

// Function to check WhatsApp registration status
async function checkWhatsAppStatus(sock, sender, numbers) {
    let resultSummary = 'List of Numbers Checked:\n';
    let registeredCount = 0;
    let notRegisteredCount = 0;

    // Trim spaces around each number and split by commas
    const cleanedNumbers = numbers.split(',').map(num => num.trim());

    for (const num of cleanedNumbers) {
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

// Function to send quality options
async function sendQualityOptions(sock, sender, videoURL) {
    try {
        if (!ytdl.validateURL(videoURL)) {
            await sock.sendMessage(sender, { text: 'Invalid YouTube URL. Please try again.' });
            return;
        }

        const message = `
Please choose a quality:
360p
480p
720p
1080p

Reply with the desired quality (e.g., 360p).
`;
        await sock.sendMessage(sender, { text: message });
        userPhoneNumber = videoURL; // Temporarily store video URL for the user
    } catch (err) {
        console.error(err);
        await sock.sendMessage(sender, { text: 'Failed to fetch video details. Try again later.' });
    }
}

// Function to handle quality choice
async function handleQualityChoice(sender, quality) {
    try {
        const videoURL = userPhoneNumber; // Retrieve stored video URL
        const filePath = `./downloads/video_${Date.now()}_${quality}.mp4`;

        // Ensure the downloads directory exists
        if (!fs.existsSync('./downloads')) {
            fs.mkdirSync('./downloads');
        }

        // Download video
        await new Promise((resolve, reject) => {
            ytdl(videoURL, { quality })
                .pipe(fs.createWriteStream(filePath))
                .on('finish', resolve)
                .on('error', reject);
        });

        return { filePath, quality };
    } catch (err) {
        console.error(err);
        return null;
    }
}

// Function to send video
async function sendVideo(sock, sender, videoData) {
    try {
        const { filePath, quality } = videoData;
        await sock.sendMessage(sender, {
            document: { url: filePath },
            fileName: `Video_${quality}.mp4`,
            mimetype: 'video/mp4',
        });
        console.log(`Video sent successfully to ${sender}.`);
    } catch (err) {
        console.error('Error sending video:', err);
        await sock.sendMessage(sender, { text: 'Failed to send the video. Try again later.' });
    }
}

// Start the script
(async () => {
    displayBanner();
    console.log(chalk.green('Initializing WhatsApp connection...'));
    await connectWhatsApp();
})();
