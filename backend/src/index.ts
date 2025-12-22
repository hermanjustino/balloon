import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

admin.initializeApp();
const app = express();
const port = process.env.PORT || 8080;
const bigquery = new BigQuery();

app.use(cors());
app.use(express.json());

const PROJECT_ID = process.env.PROJECT_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Middleware to verify Firebase ID Token
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth for health check
    if (req.path === '/health') return next();

    const idToken = req.headers['x-firebase-auth'] as string;
    if (!idToken) {
        console.warn('Missing X-Firebase-Auth header');
        return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        console.log(`[AUTH] Token verified for: ${decodedToken.email}`);
        console.log(`[AUTH] Expected Admin: ${ADMIN_EMAIL}`);

        // --- CRITICAL SECURITY CHECK ---
        if (decodedToken.email !== ADMIN_EMAIL) {
            console.warn(`[AUTH] REJECTED: ${decodedToken.email} does not match ${ADMIN_EMAIL}`);
            return res.status(403).json({
                error: 'Forbidden: Insufficient Permissions',
                debug_hint: `Identity mismatch: ${decodedToken.email} vs expected admin`
            });
        }

        (req as any).user = decodedToken;
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid Token' });
    }
};

// Use middleware for all routes
app.use(authenticate);

// 1. Overview Stats (Optimized by BI Engine)
app.get('/overview', async (req, res) => {
    try {
        const query = `
            SELECT 
                episodesAnalyzed,
                overallMatchRate,
                avgAge,
                totalParticipants,
                malePercentage,
                femalePercentage,
                lastUpdated
            FROM \`${PROJECT_ID}.balloon_dataset.aggregated_metrics\` 
            ORDER BY lastUpdated DESC 
            LIMIT 1
        `;
        const [rows] = await bigquery.query({ query });

        if (rows.length === 0) {
            return res.json({
                episodesAnalyzed: 0,
                overallMatchRate: 0,
                avgAge: 0,
                totalParticipants: 0,
                malePercentage: 0,
                femalePercentage: 0,
                lastUpdated: new Date().toISOString()
            });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching overview stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Trend Data
app.get('/trends', async (req, res) => {
    try {
        const query = `
            SELECT 
                CASE 
                    WHEN episodeNumber IS NOT NULL THEN CONCAT('Ep ', episodeNumber, ': ', episodeTitle)
                    ELSE episodeTitle 
                END as name,
                COALESCE(CAST(matchRate.float AS FLOAT64), CAST(matchRate.integer AS FLOAT64)) as rate
            FROM \`${PROJECT_ID}.balloon_dataset.analyses\`
            ORDER BY dateAnalyzed DESC
            LIMIT 20
        `;
        const [rows] = await bigquery.query({ query });
        res.json(rows.reverse());
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 3. NEW: Location Stats
app.get('/locations', async (req, res) => {
    try {
        const query = `
            SELECT 
                location.city as location,
                COUNT(*) as count
            FROM \`${PROJECT_ID}.balloon_dataset.contestants\`
            WHERE location.city IS NOT NULL AND location.city != 'Unknown'
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const [rows] = await bigquery.query({ query });
        res.json(rows);
    } catch (error) {
        console.error('Error fetching location stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Health Check (Public, no auth)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', project: PROJECT_ID });
});

app.listen(port, () => {
    console.log(`Stats API listening on port ${port}`);
});
