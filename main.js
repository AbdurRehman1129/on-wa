const { WAConnection } = require('@adiwajshing/baileys');
const readline = require('readline');

// Function to prompt for input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer);
    }));
}

// Function to check WhatsApp numbers
async function checkNumbersOnWhatsApp() {
    const conn = new WAConnection();

    console.log("Connecting to WhatsApp...");
    await conn.connect();
    console.log("Connected!");

    // Ask user for numbers
    const inputNumbers = await askQuestion("Enter numbers separated by commas: ");
    const numberList = inputNumbers.split(',').map(num => num.trim());
    const onWhatsApp = [];
    const notOnWhatsApp = [];

    // Loop through numbers and check
    for (let number of numberList) {
        try {
            const [result] = await conn.onWhatsApp(number + '@s.whatsapp.net');
            if (result.exists) {
                onWhatsApp.push(number);
            } else {
                notOnWhatsApp.push(number);
            }
        } catch (error) {
            console.error(`Error checking ${number}:`, error.message);
        }
    }

    console.log("\nNumbers on WhatsApp:");
    console.log(onWhatsApp.length > 0 ? onWhatsApp.join(', ') : "None");

    console.log("\nNumbers not on WhatsApp:");
    console.log(notOnWhatsApp.length > 0 ? notOnWhatsApp.join(', ') : "None");

    conn.close();
}

// Run the function
checkNumbersOnWhatsApp();
