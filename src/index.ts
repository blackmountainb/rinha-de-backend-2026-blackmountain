import express from 'express';
import { client } from './redis.js';
import { normalizationConstants, mccRisk } from './resources.js';
import fraudScore from './routes/fraudScore.js';
import ready from './routes/ready.js';
import { initReferencesCache } from './vectorSearch.js';
import * as fs from 'fs';

const app = express();
const PORT = 9999;

export let isReady = false;

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.path;
    const timestamp = new Date().toISOString();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${timestamp}] ${method} ${path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

app.use('/api/fraud-score', fraudScore);
app.use('/api/ready', ready);

async function startServer() {
    try {
        await initializeCache();
        isReady = true;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

await startServer();

export async function initializeCache() {
    try {
        await client.connect();

        await client.set('normalizationConstants', JSON.stringify(normalizationConstants), {
            EX: 86400 * 7
        });

        await client.set('mccRisk', JSON.stringify(mccRisk), {
            EX: 86400 * 7
        });

        await loadGzipFile('./src/resources/references.json.gz')

        await initReferencesCache();

        console.log('Normalization data cached in Redis');
        console.log('API is ready for usage!');
    } catch(error) {
        console.error('Error initializing cache', error);
    }
    
}

async function loadGzipFile(filePath: string) {
    const compressedData = fs.readFileSync(filePath);
    // Redis stores strings by default; encode the gzip Buffer as base64
    await client.set('references', compressedData.toString('base64'));
    console.log("Data stored (base64) in Redis successfully");
}
