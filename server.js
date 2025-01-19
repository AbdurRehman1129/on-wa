const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Add this line
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const path = require('path');

const app = express();
app.use(cors({
    origin: 'https://hassamhanif.github.io',  // Allow requests only from your GitHub Pages
    methods: ['GET', 'POST', 'OPTIONS'],    // Allow GET, POST, and OPTIONS methods
    allowedHeaders: ['Content-Type'],        // Allow Content-Type headers
    credentials: true,                       // If you are using cookies or authentication
  }));
  

// Ensure the auth directory exists
const authDir = path.resolve('./auth');

// Load WhatsApp session
const initializeAuthState = async () => {
    return await useMultiFileAuthState(authDir);
};

(async () => {
    const { state, saveCreds } = await initializeAuthState();

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Print the QR code in the terminal for WhatsApp login
    });

    sock.ev.on('creds.update', saveCreds); // Save session credentials when updated

    // Endpoint for checking numbers
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
                notRegistered.push(number); // Treat as not registered in case of error
            }
        }

        res.json({ registered, notRegistered });
    });

    // Start the server
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://3.106.229.168:${PORT}`);
        console.log('Make sure to scan the QR code if not logged in.');
    });
})();
