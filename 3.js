const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const ytdl = require('ytdl-core');

// Logger configuration
const logger = P({ level: 'silent' }); // Suppress logs

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
                const isLoggedOut = lastDisconnect?.error?.output?.statusCode === 401;
                if (isLoggedOut) {
                    console.log(chalk.red('Logged out. Please delete the auth folder and re-run the script.'));
                    process.exit(1);
                }
                console.log(chalk.yellow('Reconnecting...'));
                await connectWhatsApp();
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

                // Validate YouTube URL
                if (!ytdl.validateURL(ytLink)) {
                    await sock.sendMessage(sender, {
                        text: 'Invalid YouTube link. Please provide a valid YouTube video URL.'
                    });
                    return;
                }

                // Ask for quality selection
                await askQuality(sock, sender, ytLink);
            }
        }
    });
}

// Function to ask quality selection
async function askQuality(sock, sender, ytLink) {
    const qualities = [
        { key: '1', quality: '144p' },
        { key: '2', quality: '360p' },
        { key: '3', quality: '480p' },
        { key: '4', quality: '720p' },
        { key: '5', quality: '1080p' },
    ];

    const optionsText = qualities.map(q => `${q.key} for ${q.quality}`).join('\n');
    const promptText = `Choose the quality for the video:\n${optionsText}`;

    await sock.sendMessage(sender, { text: promptText });

    // Listen for the quality selection
    sock.ev.once('messages.upsert', async (m) => {
        const response = m.messages[0].message.conversation.trim();
        const selectedQuality = qualities.find(q => q.key === response);

        if (!selectedQuality) {
            await sock.sendMessage(sender, { text: 'Invalid selection. Please try again.' });
            return;
        }

        // Proceed to download the video
        await handleQualityChoice(sock, sender, ytLink, selectedQuality.quality);
    });
}

// Function to handle quality choice and download the video
async function handleQualityChoice(sock, sender, ytLink, quality) {
    try {
        const videoInfo = await ytdl.getInfo(ytLink);
        const format = ytdl.chooseFormat(videoInfo.formats, { quality });

        if (!format) {
            await sock.sendMessage(sender, { text: `Video is not available in ${quality}.` });
            return;
        }

        const filePath = `./videos/${videoInfo.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

        await new Promise((resolve, reject) => {
            const videoStream = ytdl(ytLink, { format });
            const writeStream = fs.createWriteStream(filePath);

            videoStream.pipe(writeStream);
            videoStream.on('end', resolve);
            videoStream.on('error', reject);
        });

        // Send the video back to the user
        await sock.sendMessage(sender, {
            text: `Here is your video in ${quality}:`,
        });
        await sock.sendMessage(sender, {
            document: { url: filePath },
            mimetype: 'video/mp4',
            fileName: `${videoInfo.videoDetails.title}.mp4`,
        });

        // Cleanup
        fs.unlinkSync(filePath);
    } catch (err) {
        console.error(err);
        await sock.sendMessage(sender, { text: `Error downloading the video: ${err.message}` });
    }
}

// Start the script
(async () => {
    displayBanner();
    console.log(chalk.green('Initializing WhatsApp connection...'));
    await connectWhatsApp();
})();
