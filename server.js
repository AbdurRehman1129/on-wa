const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const path = require('path');

const app = express();

// Use CORS Middleware for Full Coverage
app.use(cors({
    origin: 'https://hassamhanif.github.io', // Your frontend URL
    methods: ['GET', 'POST', 'OPTIONS'],     // Allowed methods
    allowedHeaders: ['Content-Type'],        // Allowed headers
    credentials: true                        // Allow credentials
}));

// Handle Preflight Requests
app.options('*', cors());

// Parse JSON Body
app.use(bodyParser.json());

// Define Constants
const authDir = path.resolve('./auth');
const initializeAuthState = async () => {
    return await useMultiFileAuthState(authDir);
};

// Initialize WhatsApp Socket
(async () => {
    const { state, saveCreds } = await initializeAuthState();

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    // Endpoint to Check WhatsApp Registration
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

    // Start the Server
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://my-backend.zapto.org:${PORT}`);
    });
})();
