import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';
import { runIngest } from './ingest';
import {
    getOutcomes,
    getKidsStats,
    getReligionBreakdown,
    getAgeGaps,
    getGeoMatches,
    getBestEpisodes,
    getIndustries,
    getDealbreakers,
    getDramaScores,
} from './stats-queries';

admin.initializeApp({ projectId: process.env.PROJECT_ID || 'balloon-87473' });
const app = express();
const port = process.env.PORT || 8080;
const PROJECT_ID = process.env.PROJECT_ID || 'balloon-87473';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const bigquery = new BigQuery({ projectId: PROJECT_ID });

app.use(cors());
app.use(express.json());

// Middleware to verify Firebase ID Token
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth for health check and public stats
    if (req.path === '/health' || req.path.startsWith('/api/stats') || req.path === '/ingest/run') return next();

    const idToken = req.headers['x-firebase-auth'] as string;
    if (!idToken) {
        console.warn('Missing X-Firebase-Auth header');
        return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }
    // ... rest of auth logic

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
app.get('/api/stats/overview', async (req, res) => {
    try {
        console.log(`[QUERY] Fetching overview from ${PROJECT_ID}.balloon_dataset.aggregated_metrics`);
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
        console.log(`[QUERY] Rows found: ${rows.length}`);

        if (rows.length > 0) {
            console.log(`[QUERY] Latest data point:`, JSON.stringify(rows[0]));
        }

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
    } catch (error: any) {
        console.error('Error fetching overview stats:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 2. Trend Data
app.get('/api/stats/trends', async (req, res) => {
    try {
        const query = `
            SELECT 
                name,
                rate
            FROM \`${PROJECT_ID}.balloon_dataset.aggregated_trends\`
            ORDER BY dateAnalyzed DESC
        `;
        const [rows] = await bigquery.query({ query });
        res.json(rows);
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 3. NEW: Location Stats
app.get('/api/stats/locations', async (req, res) => {
    try {
        const query = `
            SELECT 
                location,
                count
            FROM \`${PROJECT_ID}.balloon_dataset.aggregated_locations\`
            ORDER BY count DESC
        `;
        const [rows] = await bigquery.query({ query });
        res.json(rows);
    } catch (error) {
        console.error('Error fetching location stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 4. Outcome Breakdown
app.get('/api/stats/outcomes', async (req, res) => {
    try {
        const rows = await getOutcomes();
        res.json(rows.map(r => ({ role: r.role, outcome: r.outcome, count: Number(r.count) })));
    } catch (e: any) {
        console.error('Error fetching outcomes:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 5. Kids Stats
app.get('/api/stats/kids', async (req, res) => {
    try {
        res.json(await getKidsStats());
    } catch (e: any) {
        console.error('Error fetching kids stats:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 6. Religion Breakdown
app.get('/api/stats/religion', async (req, res) => {
    try {
        const rows = await getReligionBreakdown();
        res.json(rows.map(r => ({ religion: r.religion, count: Number(r.count) })));
    } catch (e: any) {
        console.error('Error fetching religion:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 7. Age Gap Distribution in Matches
app.get('/api/stats/age-gaps', async (req, res) => {
    try {
        const rows = await getAgeGaps();
        res.json(rows.map(r => ({ range: r.age_range, count: Number(r.count) })));
    } catch (e: any) {
        console.error('Error fetching age gaps:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 8. Geographic Match Patterns
app.get('/api/stats/geo-matches', async (req, res) => {
    try {
        res.json(await getGeoMatches());
    } catch (e: any) {
        console.error('Error fetching geo matches:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 9. Best Episodes (by match rate)
app.get('/api/stats/best-episodes', async (req, res) => {
    try {
        const rows = await getBestEpisodes();
        res.json(rows.map(r => ({
            episodeNumber:  r.episode_number,
            episodeTitle:   r.episode_title,
            matchRate:      r.match_rate != null ? Number(r.match_rate) : null,
            dramaScore:     r.drama_score != null ? Number(r.drama_score) : null,
            videoUrl:       r.video_url,
        })));
    } catch (e: any) {
        console.error('Error fetching best episodes:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 10. Industry Distribution (Phase 2)
app.get('/api/stats/industries', async (req, res) => {
    try {
        const rows = await getIndustries();
        res.json(rows.map(r => ({
            industry:  r.industry,
            total:     Number(r.total),
            matched:   Number(r.matched),
            matchRate: r.match_rate != null ? Number(r.match_rate) : null,
        })));
    } catch (e: any) {
        console.error('Error fetching industries:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 11. Dealbreakers (Phase 2)
app.get('/api/stats/dealbreakers', async (req, res) => {
    try {
        const rows = await getDealbreakers();
        res.json(rows.map(r => ({ category: r.category, reason: r.reason, count: Number(r.count) })));
    } catch (e: any) {
        console.error('Error fetching dealbreakers:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// 12. Drama Scores (Phase 2)
app.get('/api/stats/drama', async (req, res) => {
    try {
        const rows = await getDramaScores();
        res.json(rows.map(r => ({
            episodeNumber:    r.episode_number,
            episodeTitle:     r.episode_title,
            dramaScore:       r.drama_score != null ? Number(r.drama_score) : null,
            memorableMoment:  r.memorable_moment,
        })));
    } catch (e: any) {
        console.error('Error fetching drama scores:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// Health Check (Public, no auth)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', project: PROJECT_ID });
});

// ---------------------------------------------------------------------------
// INGEST ENDPOINT
// Triggered by Cloud Scheduler via OIDC. Verifies the request comes from
// the designated scheduler service account before running the pipeline.
// ---------------------------------------------------------------------------
const SCHEDULER_SERVICE_ACCOUNT = process.env.SCHEDULER_SERVICE_ACCOUNT || '';

app.post('/ingest/run', async (req, res) => {
    // Verify the OIDC token sent by Cloud Scheduler
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
        console.warn('[INGEST] Missing Authorization header');
        return res.status(401).json({ error: 'Unauthorized: Missing OIDC token' });
    }

    try {
        // Google's OAuth2 tokeninfo endpoint validates OIDC tokens issued to service accounts
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (!tokenInfoRes.ok) {
            throw new Error(`Token validation failed: ${tokenInfoRes.status}`);
        }
        const tokenInfo = await tokenInfoRes.json() as any;

        const isAuthorized = (SCHEDULER_SERVICE_ACCOUNT && tokenInfo.email === SCHEDULER_SERVICE_ACCOUNT) || 
                            (ADMIN_EMAIL && tokenInfo.email === ADMIN_EMAIL);

        if (!isAuthorized) {
            console.warn(`[INGEST] Rejected: token email ${tokenInfo.email} is not authorized`);
            return res.status(403).json({ error: 'Forbidden: Identity not authorized for ingest' });
        }

        console.log(`[INGEST] Authorized request from: ${tokenInfo.email}`);
    } catch (err: any) {
        console.error('[INGEST] Token verification error:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid OIDC token' });
    }

    // Run the ingest pipeline asynchronously — respond immediately so Scheduler
    // doesn't retry on a long-running Gemini call
    res.json({ status: 'accepted', message: 'Ingest pipeline started' });

    runIngest()
        .then(result => console.log('[INGEST] Pipeline finished:', JSON.stringify(result)))
        .catch(err => console.error('[INGEST] Pipeline error:', err.message));
});

app.listen(port, () => {
    console.log(`Stats API listening on port ${port}`);
});
