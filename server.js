const express = require('express');
const bodyParser = require('body-parser');
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const path = require('path');

const app = express();

// Body Parser Middleware
app.use(bodyParser.json());

// Initialize WhatsApp Socket
const authDir = path.resolve('./auth');
const initializeAuthState = async () => {
    return await useMultiFileAuthState(authDir);
};

// Set up the WhatsApp socket
(async () => {
    const { state, saveCreds } = await initializeAuthState();

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    app.post('/check', async (req, res) => {
        const { numbers } = req.body;

        if (!numbers || !Array.isArray(numbers)) {
            return res.status(400).json({ error: 'Invalid input. Provide an array of phone numbers.' });
        }

        const registered = [];
        const notRegistered = [];
        for (const number of numbers) {
            try {
                const result = await sock.onWhatsApp(`${number}@s.whatsapp.net`);
                if (result.length > 0) {
                    registered.push(number);
                } else {
                    notRegistered.push(number);
                }
            } catch (error) {
                console.error(`Error checking number ${number}:`, error);
                notRegistered.push(number);
            }
        }

        res.json({ registered, notRegistered });
    });

    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
})();
