import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const envPath = path.join(process.cwd(), '.env');
const exampleEnvPath = path.join(process.cwd(), '.env.example');

console.log('Welcome to Auto-Academic Formatter Setup!');
console.log('-----------------------------------------');

// Check if .env exists
if (fs.existsSync(envPath)) {
    console.log('Configuration file (.env) already exists.');
    rl.question('Do you want to reconfigure? (y/N): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            configure();
        } else {
            console.log('Setup skipped.');
            rl.close();
        }
    });
} else {
    configure();
}

function configure() {
    console.log('\nSetting up default configuration...');

    let content = '';
    if (fs.existsSync(exampleEnvPath)) {
        content = fs.readFileSync(exampleEnvPath, 'utf-8');
    } else {
        // Default content if example is missing
        content = `POE_WRITER_BOT=Claude-Opus-4.5
POE_SEARCH_BOT=Gemini-2.5-Pro
POE_CRITIC_BOT=GPT-5.1
PORT=5000
NODE_ENV=development
`;
    }

    // Ensure defaults are set
    if (!content.includes('PORT=')) content += '\nPORT=5000';
    if (!content.includes('NODE_ENV=')) content += '\nNODE_ENV=development';

    fs.writeFileSync(envPath, content);
    console.log('\nConfiguration saved to .env');
    console.log('Setup complete! You can now run the application.');
    rl.close();
}
