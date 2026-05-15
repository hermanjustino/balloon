import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';
import { runIngest, analyzeTranscript, fetchComments, analyzeCommentSentiment, saveCommentSentiment, saveToFirestore } from './ingest';
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
        (req.method === 'GET' && req.path.startsWith('/api/sentiment')) ||
        req.path.startsWith('/api/contestants') ||
        req.path.startsWith('/contestants') ||
        req.path.startsWith('/api/episodes') ||
        req.path.startsWith('/episodes') ||
        req.path === '/api/search' ||
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

// 14. Comment Sentiment — public
app.get('/api/sentiment', async (_req, res) => {
    try {
        const db = admin.firestore();
        const snap = await db.collection('episode_sentiment').get();
        const rows = snap.docs
            .map(d => {
                const data = d.data() as any;
                return {
                    episodeId:               data.episodeId,
                    episodeNumber:           data.episodeNumber,
                    overallSentiment:        data.overallSentiment,
                    sentimentScore:          data.sentimentScore,
                    positivePercent:         data.positivePercent,
                    negativePercent:         data.negativePercent,
                    neutralPercent:          data.neutralPercent,
                    humorPercent:            data.humorPercent,
                    topThemes:               data.topThemes,
                    audienceSummary:         data.audienceSummary,
                    topPraises:              data.topPraises,
                    topCritiques:            data.topCritiques,
                    mostDiscussedContestant: data.mostDiscussedContestant,
                    sampleSize:              data.sampleSize,
                    analyzedAt:              data.analyzedAt,
                };
            })
            .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));
        res.json(rows);
    } catch (e: any) {
        console.error('[SENTIMENT] List error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/sentiment/:episodeId', async (req, res) => {
    try {
        const db = admin.firestore();
        const epId = `ep_${req.params.episodeId}`;
        const snap = await db.collection('episode_sentiment').doc(epId).get();
        if (!snap.exists) return res.status(404).json({ error: 'Not found' });
        res.json(snap.data());
    } catch (e: any) {
        console.error('[SENTIMENT] Detail error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 15. On-demand sentiment trigger (admin only)
app.post('/api/sentiment/:episodeId/analyze', async (req, res) => {
    try {
        const db = admin.firestore();
        const epId = `ep_${req.params.episodeId}`;
        const processedSnap = await db.collection('processed_episodes')
            .where('episodeId', '==', epId)
            .limit(1)
            .get();

        if (processedSnap.empty) return res.status(404).json({ error: 'Episode not found in processed_episodes' });

        const { videoId, episodeNumber } = processedSnap.docs[0].data() as any;
        const comments = await fetchComments(videoId, 100);
        if (comments.length === 0) return res.json({ message: 'No comments available' });

        const sentiment = await analyzeCommentSentiment(comments, episodeNumber);
        await saveCommentSentiment(epId, episodeNumber, videoId, comments, sentiment);
        res.json({ episodeId: epId, ...sentiment });
    } catch (e: any) {
        console.error('[SENTIMENT] Analyze error:', e.message);
        res.status(500).json({ error: e.message });
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

// Save analysis — admin only. Browser clients call this instead of writing
// normalized collections directly through the Firebase SDK.
app.post('/api/save', async (req, res) => {
    const { result, transcript } = req.body;
    if (!result?.id) return res.status(400).json({ error: 'result.id is required' });

    try {
        await saveToFirestore(result, transcript);
        res.json({ status: 'saved', episodeId: result.id });
    } catch (err: any) {
        console.error('[SAVE] Error:', err.message);
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

let indexHtmlCache: { html: string; fetchedAt: number } | null = null;
const INDEX_HTML_TTL_MS = 5 * 60 * 1000;

async function getIndexHtml(): Promise<string> {
    const now = Date.now();
    if (indexHtmlCache && now - indexHtmlCache.fetchedAt < INDEX_HTML_TTL_MS) {
        return indexHtmlCache.html;
    }
    const res = await fetch('https://balloon-87473.web.app/index.html');
    if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`);
    const html = await res.text();
    indexHtmlCache = { html, fetchedAt: now };
    return html;
}

function injectOgTags(html: string, pageTitle: string, metaTags: string): string {
    return html
        .replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`)
        .replace('</head>', `${metaTags}\n</head>`);
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

// Serves real index.html with OG tags injected — crawlers get meta tags, users get the full React app
app.get('/contestants/:slug', async (req, res) => {
    try {
        const list = await buildContestantsList();
        const c = list.find(x => x.slug === req.params.slug);
        if (!c) return res.status(404).send('Not found');

        const name = escapeHtml(c.name || 'Contestant');
        const age = escapeHtml(String(c.age || ''));
        const location = typeof c.location === 'object'
            ? escapeHtml([c.location?.city, c.location?.state].filter(Boolean).join(', '))
            : escapeHtml(c.location || '');
        const job = escapeHtml(c.jobs?.length ? c.jobs[0] : (c.job || ''));
        const outcome = escapeHtml(c.outcome || 'Unknown');
        const partner = escapeHtml(c.partnerName || '');
        const epNum = escapeHtml((c.episodeId as string)?.replace('ep_', '') || '');

        const descParts = [
            age ? `${age} years old` : '',
            location,
            job,
            outcome === 'Matched' && partner
                ? `Matched with ${partner} on Ep. ${epNum}`
                : `${outcome} on Ep. ${epNum}`,
        ].filter(Boolean);
        const description = escapeHtml(descParts.join(' · '));

        const siteUrl = 'https://luvlytics.xyz';
        const pageUrl = `${siteUrl}/contestants/${req.params.slug}`;

        const metaTags = `  <meta name="description" content="${description}">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${name} — Pop the Balloon">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Luvlytics">
  <meta property="og:image" content="${siteUrl}/og-default.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${name} — Pop the Balloon">
  <meta name="twitter:description" content="${description}">
  <link rel="canonical" href="${pageUrl}">`;

        const html = await getIndexHtml();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(injectOgTags(html, `${name} — Pop the Balloon | Luvlytics`, metaTags));
    } catch (e: any) {
        console.error('[CONTESTANTS-OG] Error:', e.message);
        res.status(500).send('<html><body>Error loading profile.</body></html>');
    }
});

// ---------------------------------------------------------------------------
// EPISODE PAGES
// ---------------------------------------------------------------------------

// Public: list all episodes
app.get('/api/episodes', async (_req, res) => {
    try {
        const db = admin.firestore();
        const snap = await db.collection('analyses').get();
        const episodes = snap.docs
            .map(d => {
                const data = d.data() as any;
                const rawEpNum = data.episodeNumber || (d.id.startsWith('ep_') ? d.id.replace('ep_', '') : null);
                if (!rawEpNum || isNaN(Number(rawEpNum))) return null;
                return {
                    id: d.id,
                    episodeNumber: String(rawEpNum),
                    episodeTitle: data.episodeTitle || null,
                    matchRate: data.matchRate != null ? Number(data.matchRate) : null,
                    videoUrl: data.videoUrl || null,
                    dramaScore: data.dramaScore != null ? Number(data.dramaScore) : null,
                    contestantCount: Array.isArray(data.contestants) ? data.contestants.length : 0,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => Number(b.episodeNumber) - Number(a.episodeNumber));
        res.json(episodes);
    } catch (e: any) {
        console.error('[EPISODES] List error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Public: single episode by number
app.get('/api/episodes/:id', async (req, res) => {
    try {
        const db = admin.firestore();
        const epId = `ep_${req.params.id}`;
        const analysisSnap = await db.collection('analyses').doc(epId).get();
        if (!analysisSnap.exists) return res.status(404).json({ error: 'Not found' });

        const analysis = analysisSnap.data() as any;
        const rawEpNum = analysis.episodeNumber || req.params.id;

        const allContestants = await buildContestantsList();
        const contestants = allContestants.filter(c => c.episodeId === epId);

        res.json({
            id: epId,
            episodeNumber: String(rawEpNum),
            episodeTitle: analysis.episodeTitle || null,
            matchRate: analysis.matchRate != null ? Number(analysis.matchRate) : null,
            videoUrl: analysis.videoUrl || null,
            dramaScore: analysis.dramaScore != null ? Number(analysis.dramaScore) : null,
            memorableMoment: analysis.memorableMoment || null,
            contestants,
        });
    } catch (e: any) {
        console.error('[EPISODES] Detail error:', e.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Serves real index.html with OG tags injected — crawlers get meta tags, users get the full React app
app.get('/episodes/:id', async (req, res) => {
    try {
        const db = admin.firestore();
        const epId = `ep_${req.params.id}`;
        const analysisSnap = await db.collection('analyses').doc(epId).get();
        if (!analysisSnap.exists) return res.status(404).send('Not found');

        const analysis = analysisSnap.data() as any;
        const epNum = escapeHtml(String(analysis.episodeNumber || req.params.id));
        const title = escapeHtml(analysis.episodeTitle || `Episode ${epNum}`);
        const matchRate = analysis.matchRate != null ? Math.round(Number(analysis.matchRate)) : null;
        const contestantCount = Array.isArray(analysis.contestants) ? analysis.contestants.length : 0;

        const descParts = [
            matchRate != null ? `Match rate: ${matchRate}%` : '',
            contestantCount ? `${contestantCount} contestants` : '',
        ].filter(Boolean);
        const description = escapeHtml(descParts.join(' · '));

        const siteUrl = 'https://luvlytics.xyz';
        const pageUrl = `${siteUrl}/episodes/${req.params.id}`;

        const metaTags = `  <meta name="description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="Ep. ${epNum}: ${title} — Pop the Balloon">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Luvlytics">
  <meta property="og:image" content="${siteUrl}/og-default.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Ep. ${epNum}: ${title} — Pop the Balloon">
  <meta name="twitter:description" content="${description}">
  <link rel="canonical" href="${pageUrl}">`;

        const html = await getIndexHtml();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(injectOgTags(html, `Ep. ${epNum}: ${title} — Pop the Balloon | Luvlytics`, metaTags));
    } catch (e: any) {
        console.error('[EPISODES-OG] Error:', e.message);
        res.status(500).send('<html><body>Error loading episode.</body></html>');
    }
});

// ---------------------------------------------------------------------------
// CONVERSATIONAL SEARCH
// Gathers all aggregate data + contestant/episode context, sends to Gemini,
// returns a natural-language answer. Gemini key stays server-side.
// ---------------------------------------------------------------------------
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'query is required' });

    try {
        const db = admin.firestore();

        const [
            overviewRows,
            outcomes,
            locationRows,
            religion,
            ageGaps,
            geoMatches,
            bestEpisodes,
            industries,
            dealbreakers,
            dramaScores,
            ageMatchRates,
            kidsStats,
            contestantsSnap,
            analysesSnap,
        ] = await Promise.all([
            bigquery.query({ query: `SELECT episodesAnalyzed, overallMatchRate, avgAge, totalParticipants, malePercentage, femalePercentage FROM \`${PROJECT_ID}.balloon_dataset.aggregated_metrics\` ORDER BY lastUpdated DESC LIMIT 1` }).then(([r]) => r),
            getOutcomes(),
            bigquery.query({ query: `SELECT location, count FROM \`${PROJECT_ID}.balloon_dataset.aggregated_locations\` ORDER BY count DESC LIMIT 30` }).then(([r]) => r),
            getReligionBreakdown(),
            getAgeGaps(),
            getGeoMatches(),
            getBestEpisodes(),
            getIndustries(),
            getDealbreakers(),
            getDramaScores(),
            getAgeMatchRate(),
            getKidsStats(),
            db.collection('contestants').get(),
            db.collection('analyses').get(),
        ]);

        const contestants = contestantsSnap.docs.map(d => {
            const data = d.data() as any;
            const loc = typeof data.location === 'object' && data.location
                ? [data.location.city, data.location.state].filter(Boolean).join(', ')
                : (data.location || '');
            return {
                name: data.name,
                age: data.age,
                location: loc,
                job: data.jobs?.[0] || data.job || '',
                outcome: data.outcome,
                episode: (data.episodeId as string)?.replace('ep_', '') || '',
            };
        });

        const episodes = analysesSnap.docs.map(d => {
            const data = d.data() as any;
            const epNum = data.episodeNumber || (d.id.startsWith('ep_') ? d.id.replace('ep_', '') : null);
            if (!epNum || isNaN(Number(epNum))) return null;
            return {
                episode: epNum,
                title: data.episodeTitle || null,
                matchRate: data.matchRate != null ? Number(data.matchRate) : null,
                dramaScore: data.dramaScore != null ? Number(data.dramaScore) : null,
                memorableMoment: data.memorableMoment || null,
            };
        }).filter(Boolean).sort((a: any, b: any) => Number(a.episode) - Number(b.episode));

        const context = {
            overview: overviewRows[0],
            topLocations: locationRows,
            outcomes: outcomes.map(r => ({ role: r.role, outcome: r.outcome, count: Number(r.count) })),
            religion: religion.map(r => ({ religion: r.religion, count: Number(r.count) })),
            ageGaps: ageGaps.map(r => ({ range: r.age_range, count: Number(r.count) })),
            geoMatches,
            bestEpisodes: bestEpisodes.map(r => ({ episode: r.episode_number, title: r.episode_title, matchRate: r.match_rate != null ? Number(r.match_rate) : null, dramaScore: r.drama_score != null ? Number(r.drama_score) : null })),
            industries: industries.map(r => ({ industry: r.industry, total: Number(r.total), matched: Number(r.matched), matchRate: r.match_rate != null ? Number(r.match_rate) : null })),
            dealbreakers: dealbreakers.map(r => ({ category: r.category, reason: r.reason, count: Number(r.count) })),
            dramaScores: dramaScores.map(r => ({ episode: r.episode_number, title: r.episode_title, dramaScore: r.drama_score != null ? Number(r.drama_score) : null, memorableMoment: r.memorable_moment })),
            ageMatchRates: ageMatchRates.map(r => ({ age: Number(r.age), total: Number(r.total), matched: Number(r.matched), matchRate: r.match_rate != null ? Number(r.match_rate) : null })),
            kidsStats,
            contestants,
            episodes,
        };

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const prompt = `You are a data analyst for "Pop the Balloon", a Canadian dating show. Answer the question below using only the data provided. Be concise and direct. Format numbers clearly (percentages, counts). If the data doesn't contain the answer, say so honestly.

DATA:
${JSON.stringify(context)}

QUESTION: ${query}

ANSWER:`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });

        res.json({ answer: response.text });
    } catch (e: any) {
        console.error('[SEARCH] Error:', e.message);
        res.status(500).json({ error: 'Search failed' });
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
