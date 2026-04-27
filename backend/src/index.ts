import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';
import { runIngest, analyzeTranscript } from './ingest';
import { GoogleGenAI, Type } from '@google/genai';
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
    getAgeMatchRate,
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
    // Skip auth for health check, public stats, public contestant pages, and ingest
    if (
        req.path === '/health' ||
        req.path.startsWith('/api/stats') ||
        req.path.startsWith('/api/contestants') ||
        req.path.startsWith('/contestants') ||
        req.path === '/ingest/run'
    ) return next();

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
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
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

// 13. Age Match Rates
app.get('/api/stats/age-match', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        const rows = await getAgeMatchRate();
        res.json(rows.map(r => ({
            age:       Number(r.age),
            total:     Number(r.total),
            matched:   Number(r.matched),
            matchRate: r.match_rate != null ? Number(r.match_rate) : null,
        })));
    } catch (e: any) {
        console.error('Error fetching age match rates:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
});

// Analyze transcript — admin only, key never leaves server
app.post('/api/analyze', async (req, res) => {
    const { transcript, episodeNumber, videoUrl } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });
    const epNum = String(episodeNumber || 'unknown');
    const epId = episodeNumber ? `ep_${episodeNumber}` : admin.firestore().collection('_').doc().id;
    try {
        const result = await analyzeTranscript(transcript, epNum, videoUrl || '', epId);
        res.json(result);
    } catch (err: any) {
        console.error('[ANALYZE] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Refine locations — admin only, uses Flash model (cheap)
app.post('/api/refine-locations', async (req, res) => {
    const { contestants } = req.body;
    if (!Array.isArray(contestants)) return res.status(400).json({ error: 'contestants array required' });

    const itemsToRefine = contestants.filter((c: any) => {
        if (typeof c.location === 'string') return true;
        if (typeof c.location === 'object') return !c.location.state || c.location.state === 'Unknown' || c.location.state === '';
        return false;
    });
    if (itemsToRefine.length === 0) return res.json(contestants);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const prompt = `Parse these locations into City and State. Infer State from City if missing (e.g. Miami -> FL).
LOCATIONS: ${JSON.stringify(itemsToRefine.map((c: any) => typeof c.location === 'string' ? c.location : c.location.original || c.location.city))}
Return JSON array with objects: { original, city, state, country }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            original: { type: Type.STRING },
                            city: { type: Type.STRING },
                            state: { type: Type.STRING },
                            country: { type: Type.STRING },
                        },
                        required: ['original', 'city', 'state'],
                    },
                },
            },
        });
        const parsedLocations = JSON.parse(response.text ?? '[]') as any[];
        const refined = contestants.map((c: any) => {
            if (!itemsToRefine.includes(c)) return c;
            const key = typeof c.location === 'string' ? c.location : (c.location.original || c.location.city);
            const match = parsedLocations.find((p: any) => p.original === key);
            return match ? { ...c, location: { city: match.city, state: match.state, country: match.country || 'US', original: key } } : c;
        });
        res.json(refined);
    } catch (err: any) {
        console.error('[REFINE-LOCATIONS] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// CONTESTANT PAGES
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function buildContestantsList() {
    const db = admin.firestore();
    const [contestantsSnap, couplesSnap] = await Promise.all([
        db.collection('contestants').get(),
        db.collection('couples').get(),
    ]);

    const couples = couplesSnap.docs.map(d => d.data());

    const raw = contestantsSnap.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id,
        _baseSlug: toSlug((doc.data() as any).name || 'unknown'),
    }));

    const slugCount: Record<string, number> = {};
    raw.forEach(c => { slugCount[c._baseSlug] = (slugCount[c._baseSlug] || 0) + 1; });

    return raw.map(c => {
        const slug = slugCount[c._baseSlug] > 1
            ? `${c._baseSlug}-ep-${(c.episodeId as string)?.replace('ep_', '') || '0'}`
            : c._baseSlug;

        const couple = couples.find((cp: any) =>
            cp.contestant1Id === c.id || cp.contestant2Id === c.id
        );
        const partnerName = couple
            ? (couple.contestant1Id === c.id ? couple.person2 : couple.person1)
            : null;

        const { _baseSlug, ...rest } = c;
        return { ...rest, slug, partnerName };
    });
}

// Public: list all contestants
app.get('/api/contestants', async (_req, res) => {
    try {
        res.json(await buildContestantsList());
    } catch (e: any) {
        console.error('[CONTESTANTS] List error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Public: single contestant by slug
app.get('/api/contestants/:slug', async (req, res) => {
    try {
        const list = await buildContestantsList();
        const contestant = list.find(c => c.slug === req.params.slug);
        if (!contestant) return res.status(404).json({ error: 'Not found' });

        const db = admin.firestore();
        const analysisSnap = await db.collection('analyses').doc(contestant.episodeId).get();
        const analysis = analysisSnap.exists ? analysisSnap.data() : null;

        res.json({
            ...contestant,
            videoUrl: analysis?.videoUrl || null,
            episodeTitle: analysis?.episodeTitle || null,
            episodeNumber: analysis?.episodeNumber || null,
        });
    } catch (e: any) {
        console.error('[CONTESTANTS] Detail error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Server-rendered profile page with OG meta tags for social sharing
app.get('/contestants/:slug', async (req, res) => {
    try {
        const list = await buildContestantsList();
        const c = list.find(x => x.slug === req.params.slug);

        if (!c) {
            return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not Found | Luvlytics</title></head><body style="font-family:sans-serif;padding:2rem"><p>Contestant not found.</p><a href="https://luvlytics.xyz">← Luvlytics</a></body></html>`);
        }

        const name = escapeHtml(c.name || 'Contestant');
        const age = escapeHtml(String(c.age || ''));
        const location = typeof c.location === 'object'
            ? escapeHtml([c.location?.city, c.location?.state].filter(Boolean).join(', '))
            : escapeHtml(c.location || '');
        const job = escapeHtml((c.jobs?.length ? c.jobs[0] : (c.job || '')));
        const outcome = escapeHtml(c.outcome || 'Unknown');
        const partner = escapeHtml(c.partnerName || '');
        const epNum = escapeHtml((c.episodeId as string)?.replace('ep_', '') || '');
        const slug = req.params.slug;

        const descParts = [
            age ? `${age} years old` : '',
            location,
            job,
            outcome === 'Matched' && partner ? `Matched with ${partner} on Ep. ${epNum}` : `${outcome} on Ep. ${epNum}`,
        ].filter(Boolean);
        const description = escapeHtml(descParts.join(' · '));

        const siteUrl = 'https://luvlytics.xyz';
        const profileUrl = `${siteUrl}/contestants/${slug}`;
        const oc = c.outcome === 'Matched' ? '#2d6a4f' : c.outcome === 'Walked Away' ? '#6b6b6b' : '#C13111';

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Pop the Balloon | Luvlytics</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${name} — Pop the Balloon">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${profileUrl}">
  <meta property="og:site_name" content="Luvlytics">
  <meta property="og:image" content="${siteUrl}/og-default.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${name} — Pop the Balloon">
  <meta name="twitter:description" content="${description}">
  <link rel="canonical" href="${profileUrl}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#EFE9E0;--surface:#8B210A;--primary:#C13111;--text:#3E2723;--oc:#EFE9E0;--taupe:#C6B7A6}
    body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh}
    .page{max-width:640px;margin:0 auto;padding:2rem 1.5rem}
    .nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:3rem}
    .brand{font-family:'DM Serif Display',serif;font-size:1.5rem;color:var(--primary);text-decoration:none}
    .nav-link{font-size:.875rem;color:var(--text);text-decoration:none;opacity:.65}
    .profile-name{font-family:'DM Serif Display',serif;font-size:2.5rem;color:var(--primary);line-height:1.1}
    .meta{margin-top:.75rem;display:flex;flex-wrap:wrap;gap:.5rem 1rem;font-size:1rem;opacity:.72}
    .badge{display:inline-block;margin-top:.875rem;padding:.28rem .9rem;border-radius:999px;font-size:.8rem;font-weight:600;letter-spacing:.04em;color:white}
    .card{background:var(--surface);color:#EFE9E0;border-radius:16px;padding:1.5rem;margin-bottom:1.25rem}
    .glass-card{background:rgba(139,33,10,.12);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(193,49,17,.25);border-radius:16px;padding:1.5rem;margin-bottom:1.25rem}
    .label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-bottom:.5rem}
    .value{font-family:'DM Serif Display',serif;font-size:1.5rem}
    .cta{display:block;padding:1rem;text-align:center;text-decoration:none;border-radius:12px;font-size:1rem;font-weight:600;margin-top:.75rem}
    .cta-primary{background:var(--surface);color:#EFE9E0}
    .cta-secondary{background:transparent;color:var(--primary);border:1.5px solid var(--primary)}
  </style>
</head>
<body>
<div class="page">
  <nav class="nav">
    <a class="brand" href="${siteUrl}">Luvlytics</a>
    <a class="nav-link" href="${siteUrl}/contestants">All Contestants →</a>
  </nav>
  <div style="margin-bottom:2.5rem">
    <h1 class="profile-name">${name}</h1>
    <div class="meta">
      ${age ? `<span>${age} yrs</span>` : ''}
      ${location ? `<span>${location}</span>` : ''}
      ${job ? `<span>${job}</span>` : ''}
    </div>
    <span class="badge" style="background:${oc}">${outcome}</span>
  </div>
  ${outcome === 'Matched' && partner ? `
  <div class="glass-card">
    <div class="label" style="color:var(--primary);opacity:.8">Matched with</div>
    <div class="value" style="color:var(--primary)">${partner}</div>
    ${epNum ? `<div style="margin-top:.3rem;font-size:.875rem;opacity:.6">Episode ${epNum}</div>` : ''}
  </div>` : (epNum ? `
  <div class="card">
    <div class="label">Episode</div>
    <div class="value">${epNum}</div>
  </div>` : '')}
  <a class="cta cta-primary" href="${siteUrl}">View Full Dashboard →</a>
  <a class="cta cta-secondary" href="${siteUrl}/contestants">All Contestants</a>
</div>
</body>
</html>`);
    } catch (e: any) {
        console.error('[CONTESTANTS-OG] Error:', e.message);
        res.status(500).send('<html><body>Error loading profile.</body></html>');
    }
});

// Health Check (Public, no auth)
app.get('/health', (_req, res) => {
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
