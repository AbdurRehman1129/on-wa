const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const path = require('path');

const app = express();

// Add CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://hassamhanif.github.io'); // Allow your frontend origin
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');          // Allow these methods
    res.header('Access-Control-Allow-Headers', 'Content-Type');                // Allow this header
    res.header('Access-Control-Allow-Credentials', 'true');                    // Allow credentials
    if (req.method === 'OPTIONS') {
        return res.status(204).end(); // Respond to OPTIONS preflight with no content
    }
    next();
});

app.use(cors({ origin: 'https://hassamhanif.github.io' })); // Add this if cors() wasn't already included
app.use(bodyParser.json());

// Your existing backend code continues here
const authDir = path.resolve('./auth');
const initializeAuthState = async () => {
    return await useMultiFileAuthState(authDir);
};

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
