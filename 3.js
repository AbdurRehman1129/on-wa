const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const ytdl = require('ytdl-core');

// Logger configuration
const logger = P({ level: 'silent' });

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
        logger: logger,
    });

    sock.ev.process(async events => {
        if (events['connection.update']) {
            const { connection, lastDisconnect } = events['connection.update'];
            if (connection === 'close') {
                const isLoggedOut = lastDisconnect?.error?.output?.statusCode === 401;
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

            if (text.startsWith('.video')) {
                const ytLink = text.replace('.video', '').trim();
                if (ytdl.validateURL(ytLink)) {
                    await askQuality(sock, sender, ytLink);
                } else {
                    await sock.sendMessage(sender, { text: 'Invalid YouTube link. Please try again.' });
                }
            }
        }
    });
}

// Function to ask quality and download video
async function askQuality(sock, sender, ytLink) {
    const info = await ytdl.getInfo(ytLink);
    const formats = ytdl.filterFormats(info.formats, 'videoonly');
    let qualityOptions = 'Select a quality:\n';

    formats.forEach((format, index) => {
        qualityOptions += `${index + 1}: ${format.qualityLabel}\n`;
    });

    await sock.sendMessage(sender, { text: qualityOptions });

    // Listen for response to select quality
    sock.ev.on('messages.upsert', async (m) => {
        const response = m.messages[0];
        if (response.key.remoteJid === sender) {
            const choice = parseInt(response.message.conversation.trim(), 10) - 1;
            if (choice >= 0 && choice < formats.length) {
                await downloadAndSend(sock, sender, ytLink, formats[choice]);
            } else {
                await sock.sendMessage(sender, { text: 'Invalid choice. Please try again.' });
            }
        }
    });
}

// Function to download and send video
async function downloadAndSend(sock, sender, ytLink, format) {
    const filePath = path.resolve(__dirname, 'downloaded_video.mp4');
    const stream = ytdl(ytLink, { format });

    // Save video
    stream.pipe(fs.createWriteStream(filePath)).on('finish', async () => {
        await sock.sendMessage(sender, { document: { url: filePath }, mimetype: 'video/mp4', fileName: 'video.mp4' });
        fs.unlinkSync(filePath); // Clean up file after sending
    }).on('error', async (err) => {
        console.error('Download error:', err);
        await sock.sendMessage(sender, { text: 'Failed to download video. Please try again later.' });
    });
}

// Start the script
(async () => {
    displayBanner();
    console.log(chalk.green('Initializing WhatsApp connection...'));
    await connectWhatsApp();
})();
