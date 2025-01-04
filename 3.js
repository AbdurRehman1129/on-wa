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

            console.log(`Received message: "${text}" from: ${sender}`);

            if (text.startsWith('.check')) {
                const phoneNumbers = text.replace('.check', '').trim();
                await checkWhatsAppStatus(sock, sender, phoneNumbers);
            } else if (text.startsWith('.video')) {
                const videoURL = text.replace('.video', '').trim();
                console.log(`.video command received with URL: ${videoURL}`);
                await sendQualityOptions(sock, sender, videoURL);
            } else if (/^\d+p$/.test(text)) {
                console.log(`Quality choice received: ${text}`);
                await handleQualityChoice(sock, sender, text);
            } else {
                console.log(`Unrecognized command: ${text}`);
            }
        }
    });
}

// Function to check WhatsApp registration status
async function checkWhatsAppStatus(sock, sender, numbers) {
    let resultSummary = 'List of Numbers Checked:\n';
    let registeredCount = 0;
    let notRegisteredCount = 0;

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

    await sock.sendMessage(sender, { text: resultSummary });
}

// Send available quality options to the user
async function sendQualityOptions(sock, sender, videoURL) {
    try {
        console.log(`Validating YouTube URL: ${videoURL}`);
        if (!ytdl.validateURL(videoURL)) {
            console.log('Invalid YouTube URL.');
            await sock.sendMessage(sender, { text: 'Invalid YouTube URL. Please try again.' });
            return;
        }

        console.log('Fetching video info...');
        const info = await ytdl.getInfo(videoURL);

        const availableQualities = info.formats
            .filter(f => f.qualityLabel && f.container === 'mp4')
            .map(f => f.qualityLabel);

        console.log(`Available qualities: ${availableQualities}`);

        const message = `
Available qualities for this video:
${availableQualities.join('\n')}

Reply with the desired quality (e.g., 360p).
`;
        await sock.sendMessage(sender, { text: message });
        userPhoneNumber = videoURL; // Temporarily store video URL for the user
    } catch (err) {
        console.error('Error fetching video details:', err);
        await sock.sendMessage(sender, { text: 'Failed to fetch video details. Try again later.' });
    }
}

// Handle quality choice and download video
async function handleQualityChoice(sock, sender, quality) {
    try {
        console.log(`Fetching video with quality: ${quality}`);
        const videoURL = userPhoneNumber;

        const videoStream = ytdl(videoURL, {
            quality: quality.replace('p', ''), // Use the numerical part of the quality
        });

        const filePath = `./${Date.now()}.mp4`;
        const writeStream = fs.createWriteStream(filePath);
        videoStream.pipe(writeStream);

        writeStream.on('finish', async () => {
            console.log(`Video downloaded: ${filePath}`);
            await sock.sendMessage(sender, {
                document: { url: filePath },
                mimetype: 'video/mp4',
                fileName: 'video.mp4',
            });
            fs.unlinkSync(filePath); // Remove the file after sending
        });
    } catch (err) {
        console.error('Error downloading video:', err);
        await sock.sendMessage(sender, { text: 'Failed to download video. Try again later.' });
    }
}

// Start the script
(async () => {
    displayBanner();
    console.log(chalk.green('Initializing WhatsApp connection...'));
    await connectWhatsApp();
})();
