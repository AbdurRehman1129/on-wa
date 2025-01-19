const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const path = require('path');

const app = express();

// CORS Middleware
app.use(cors({
    origin: 'https://hassamhanif.github.io', // Ensure this matches your frontend URL
    methods: ['GET', 'POST', 'OPTIONS'],     // Allow these methods
    allowedHeaders: ['Content-Type'],        // Allow these headers
    credentials: true                        // Allow credentials (cookies, etc.)
}));

// Handle Preflight (OPTIONS) Requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', 'https://hassamhanif.github.io');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(204).end(); // Preflight request success
});

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
        console.log(`Server running on https://my-backend.zapto.org:${PORT}`);
    });
})();
