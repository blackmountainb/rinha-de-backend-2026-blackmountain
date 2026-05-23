import express from 'express';
import { client } from './redis.js';
import { normalizationConstants, mccRisk } from './resources.js';
import fraudScore from './routes/fraudScore.js';

const app = express();
const PORT = 9999;

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function initializeCache() {
    try {
        await client.connect();

        await client.set('normalizationConstants', JSON.stringify(normalizationConstants), {
            EX: 86400 * 7
        });

        await client.set('mccRisk', JSON.stringify(mccRisk), {
            EX: 86400 * 7
        });

        console.log('Normalization data cached in Redis');
    } catch(error) {
        console.error('Error initializing cache', error);
    }
    
}

await initializeCache();