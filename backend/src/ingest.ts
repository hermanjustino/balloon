import * as admin from 'firebase-admin';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/*
  -----------------------------------------------------------------------
  INGEST SERVICE
  Polls the Pop the Balloon YouTube channel for new episodes, fetches
  captions via YouTube's timedtext endpoint, runs Gemini analysis, and
  saves results to Firestore using the same schema as the frontend flow.
  -----------------------------------------------------------------------
*/

const CHANNEL_HANDLE = process.env.CHANNEL_HANDLE || 'PopTheBalloon';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SUPADATA_API_BASE = 'https://api.supadata.ai/v1';

// Matches: "Ep 92: Pop The Balloon..." OR "Ep 90 (Part 1): Pop The Balloon..."
const EPISODE_TITLE_REGEX = /^Ep\s+(\d+)(?:\s*\(Part\s*(\d+)\))?/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YouTubeVideo {
    videoId: string;
    title: string;
    publishedAt: string;
    videoUrl: string;
}

interface IngestResult {
    processed: number;
    skipped: number;
    failed: number;
    episodes: string[];
    errors: string[];
}

// ---------------------------------------------------------------------------
// YouTube helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a channel handle (e.g. "PopTheBalloon") to a channel ID (UCxxx...).
 * Uses the YouTube Data API v3 search endpoint.
 */
async function resolveChannelId(handle: string): Promise<string> {
    const url = `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube channels API error: ${res.status} ${res.statusText}`);
    const data = await res.json() as any;
    const channelId = data.items?.[0]?.id;
    if (!channelId) throw new Error(`Could not resolve channel handle: ${handle}`);
    return channelId;
}

/**
 * Lists the most recent videos from a channel's uploads playlist.
 * Filters to only videos whose titles match the episode pattern.
 * @param maxResults - how many recent videos to check (default 10, covers ~weekly cadence)
 */
async function listRecentEpisodes(channelId: string, maxResults = 10): Promise<YouTubeVideo[]> {
    // Step 1: Get the uploads playlist ID for this channel
    const channelUrl = `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const channelRes = await fetch(channelUrl);
    if (!channelRes.ok) throw new Error(`YouTube channel detail error: ${channelRes.status}`);
    const channelData = await channelRes.json() as any;
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error('Could not find uploads playlist for channel');

    // Step 2: List items in the uploads playlist
    const playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const playlistRes = await fetch(playlistUrl);
    if (!playlistRes.ok) throw new Error(`YouTube playlistItems API error: ${playlistRes.status}`);
    const playlistData = await playlistRes.json() as any;

    const videos: YouTubeVideo[] = [];
    for (const item of playlistData.items || []) {
        const title: string = item.snippet?.title || '';
        // Only process videos that match the episode title pattern
        if (!EPISODE_TITLE_REGEX.test(title)) continue;

        const videoId: string = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;

        videos.push({
            videoId,
            title,
            publishedAt: item.snippet?.publishedAt || '',
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
    }

    return videos;
}

/**
 * Extracts the episode number from a title like "Ep 92: Pop The Balloon..."
 */
function extractEpisodeNumber(title: string): string | null {
    const match = title.match(EPISODE_TITLE_REGEX);
    if (!match) return null;
    const num = match[1];
    const part = match[2];
    return part ? `${num}_pt${part}` : num;
}

/**
 * Fetches the transcript for a YouTube video via the Supadata API.
 * Returns the transcript as a plain string.
 *
 * Uses mode=native to avoid AI-generation credits — if no native transcript
 * exists yet the video is not ready to process.
 */
async function fetchCaptions(videoId: string): Promise<string> {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const apiUrl = `${SUPADATA_API_BASE}/transcript?url=${encodeURIComponent(videoUrl)}&lang=en&text=true&mode=native`;

    const res = await fetch(apiUrl, {
        headers: { 'x-api-key': SUPADATA_API_KEY },
    });

    if (res.status === 202) {
        // Supadata returns 202 for long videos and processes them async.
        // For now, treat as not-yet-ready so the next daily run picks it up.
        throw new Error(`Transcript for video ${videoId} is being processed asynchronously — will retry on next run`);
    }

    if (res.status === 206) {
        throw new Error(`No transcript available for video ${videoId} — captions may not be ready yet`);
    }

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Supadata API error for video ${videoId}: HTTP ${res.status} ${body}`);
    }

    const data = await res.json() as { content: string; lang: string };

    if (!data.content || data.content.trim() === '') {
        throw new Error(`Transcript was empty for video ${videoId}`);
    }

    return data.content.trim();
}

// ---------------------------------------------------------------------------
// Gemini analysis (mirrors frontend AIService.analyzeTranscript)
// ---------------------------------------------------------------------------

export async function analyzeTranscript(
    transcript: string,
    episodeNumber: string,
    videoUrl: string,
    episodeId: string
): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            episodeTitle: { type: Type.STRING, description: 'A short catchy title for this episode.' },
            matchRate: { type: Type.NUMBER, description: 'Percentage of couples who matched (0-100)' },
            participantCount: { type: Type.NUMBER, description: 'Total number of participants' },
            malePercentage: { type: Type.NUMBER, description: 'Percentage of male participants (0-100)' },
            femalePercentage: { type: Type.NUMBER, description: 'Percentage of female participants (0-100)' },
            matchesCount: { type: Type.NUMBER, description: 'Number of matches formed' },
            sentiment: { type: Type.STRING, description: 'Overall sentiment: Positive, Negative, Mixed, or Neutral' },
            avgAge: { type: Type.NUMBER, description: 'Average estimated age' },
            dramaScore: { type: Type.NUMBER, description: '1-10 score of how dramatic/entertaining the episode was' },
            memorableMoment: { type: Type.STRING, description: 'The single most standout or viral-worthy moment from the episode' },
            couples: {
                type: Type.ARRAY,
                description: 'List of couples who successfully matched at the end.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        person1: { type: Type.STRING, description: 'Name of the person from the Lineup' },
                        person2: { type: Type.STRING, description: 'Name of the Contestant they matched with' },
                    },
                    required: ['person1', 'person2'],
                },
            },
            contestants: {
                type: Type.ARRAY,
                description: "List of every person mentioned. CRITICAL: Distinguish between 'Lineup' (balloon holders) and 'Contestant' (person entering).",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'Name of the person' },
                        gender: { type: Type.STRING, description: "Gender: 'Male' or 'Female' (infer from name/pronouns)" },
                        age: { type: Type.STRING, description: "Age (e.g. '24', 'Unknown')" },
                        location: {
                            type: Type.OBJECT,
                            properties: {
                                city: { type: Type.STRING },
                                state: { type: Type.STRING, description: '2-letter state code (e.g. TX, CA)' },
                                country: { type: Type.STRING, description: 'Country code (default US)' },
                                original: { type: Type.STRING, description: 'Raw location string from transcript' },
                            },
                            required: ['city', 'state', 'original'],
                        },
                        job: { type: Type.STRING, description: 'Primary job title (legacy field)' },
                        jobs: {
                            type: Type.ARRAY,
                            description: "All jobs/occupations mentioned",
                            items: { type: Type.STRING },
                        },
                        industry: { type: Type.STRING, description: "Broad industry cluster based on their job (e.g., Healthcare, Tech, Creative, Blue Collar, Professional, Service)" },
                        kids: {
                            type: Type.OBJECT,
                            properties: {
                                hasKids: { type: Type.BOOLEAN },
                                count: { type: Type.NUMBER },
                                ages: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ['hasKids'],
                        },
                        religion: { type: Type.STRING, description: "Religious affiliation if mentioned" },
                        role: { type: Type.STRING, description: "MUST be 'Lineup' or 'Contestant'" },
                        outcome: { type: Type.STRING, description: "Short result: 'Matched', 'Popped', 'Eliminated', 'Walked Away'" },
                        popReason: { type: Type.STRING, description: 'If popped, the specific reason why (e.g., "Too short", "Has kids", "Job choice")' },
                        popCategory: { type: Type.STRING, description: 'Category of rejection: Appearance, Lifestyle, Vibe, Location, Dealbreaker, or Other' },
                    },
                    required: ['name', 'gender', 'age', 'location', 'role', 'outcome'],
                },
            },
        },
        required: ['episodeTitle', 'matchRate', 'participantCount', 'malePercentage', 'femalePercentage', 'matchesCount', 'sentiment', 'avgAge', 'couples', 'contestants', 'dramaScore', 'memorableMoment'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following transcript from the dating show "Pop the Balloon". This is Episode ${episodeNumber}.

FORMAT RULES:
- The show has a "Lineup" of people holding balloons.
- "Contestants" come out one by one to face the Lineup.
- You MUST classify every person as either "Lineup" or "Contestant".
- You MUST identify the gender (Male/Female) for EVERY person. Infer from name/pronouns if necessary.
- You MUST extract the specific names of couples that matched.
- Extract job(s), kids info, and religion if mentioned.
- For each person, infer a broad "industry" cluster from their job title.
- For anyone who gets "popped", extract the specific reason why and categorize it.
- Rate the overall episode drama level from 1-10 and identify the most memorable moment.

Extract statistics and any deep insights mentioned in the transcript.

TRANSCRIPT:
${transcript}`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 2048 },
        },
    });

    let jsonString = response.text ?? '';
    if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '');
    } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```/g, '');
    }

    const result = JSON.parse(jsonString);

    // Assign stable UUIDs to contestants and link couples
    const contestantsWithIds = (result.contestants || []).map((c: any) => ({
        ...c,
        id: admin.firestore().collection('_').doc().id, // generates a Firestore push ID server-side
    }));

    const couplesWithIds = (result.couples || []).map((couple: any) => {
        const c1 = contestantsWithIds.find((c: any) => c.name === couple.person1);
        const c2 = contestantsWithIds.find((c: any) => c.name === couple.person2);
        return {
            ...couple,
            contestant1Id: c1?.id || null,
            contestant2Id: c2?.id || null,
        };
    });

    return {
        ...result,
        contestants: contestantsWithIds,
        couples: couplesWithIds,
        id: episodeId,
        dateAnalyzed: new Date().toISOString().split('T')[0],
        episodeNumber,
        videoUrl,
        hasTranscript: true,
    };
}

// ---------------------------------------------------------------------------
// Firestore save (mirrors frontend StorageService.fullySaveAnalysis)
// ---------------------------------------------------------------------------

async function saveToFirestore(result: any, transcript: string): Promise<void> {
    const db = admin.firestore();
    const now = new Date().toISOString();

    await Promise.all([
        // 1. Analysis metadata
        db.collection('analyses').doc(result.id).set(result),

        // 2. Raw transcript
        db.collection('transcripts').doc(result.id).set({
            content: transcript,
            episodeTitle: result.episodeTitle,
            episodeNumber: result.episodeNumber,
            videoUrl: result.videoUrl,
            analysisId: result.id,
            createdAt: now,
        }),

        // 3. Contestants (normalized)
        ...result.contestants.map((contestant: any) =>
            db.collection('contestants').doc(contestant.id).set({
                ...contestant,
                episodeId: result.id,
                episodeNumber: result.episodeNumber || null,
                episodeTitle: result.episodeTitle || '',
                analyzedAt: now,
            })
        ),

        // 4. Couples (normalized)
        ...result.couples.map((couple: any) =>
            db.collection('couples').doc(db.collection('_').doc().id).set({
                episodeId: result.id,
                episodeNumber: result.episodeNumber || null,
                episodeTitle: result.episodeTitle || '',
                contestant1Id: couple.contestant1Id,
                contestant2Id: couple.contestant2Id,
                person1Name: couple.person1,
                person2Name: couple.person2,
                matchedAt: now,
            })
        ),
    ]);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runIngest(): Promise<IngestResult> {
    const result: IngestResult = { processed: 0, skipped: 0, failed: 0, episodes: [], errors: [] };

    if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY environment variable is not set');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY environment variable is not set');
    if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY environment variable is not set');

    const db = admin.firestore();

    // 1. Resolve channel handle → ID
    console.log(`[INGEST] Resolving channel handle: @${CHANNEL_HANDLE}`);
    const channelId = await resolveChannelId(CHANNEL_HANDLE);
    console.log(`[INGEST] Resolved channel ID: ${channelId}`);

    // 2. List recent episodes from channel
    const videos = await listRecentEpisodes(channelId, 50);
    console.log(`[INGEST] Found ${videos.length} episode(s) matching title pattern`);

    for (const video of videos) {
        const episodeNumber = extractEpisodeNumber(video.title);
        if (!episodeNumber) {
            console.warn(`[INGEST] Could not extract episode number from: "${video.title}"`);
            result.skipped++;
            continue;
        }

        const episodeId = `ep_${episodeNumber}`;

        // 3. Check if already processed
        const existing = await db.collection('processed_episodes').doc(video.videoId).get();
        if (existing.exists) {
            console.log(`[INGEST] Skipping already-processed video: ${video.videoId} (${video.title})`);
            result.skipped++;
            continue;
        }

        console.log(`[INGEST] Processing: "${video.title}" (${video.videoId})`);

        try {
            // 4. Fetch captions
            const transcript = await fetchCaptions(video.videoId);
            console.log(`[INGEST] Fetched transcript for ep ${episodeNumber}: ${transcript.length} chars`);

            // 5. Analyse with Gemini
            const analysisResult = await analyzeTranscript(transcript, episodeNumber, video.videoUrl, episodeId);
            console.log(`[INGEST] Gemini analysis complete for ep ${episodeNumber}: ${analysisResult.episodeTitle}`);

            // 6. Save to Firestore
            await saveToFirestore(analysisResult, transcript);

            // 7. Mark as processed (idempotency guard)
            await db.collection('processed_episodes').doc(video.videoId).set({
                videoId: video.videoId,
                episodeId,
                episodeNumber,
                title: video.title,
                videoUrl: video.videoUrl,
                publishedAt: video.publishedAt,
                processedAt: new Date().toISOString(),
            });

            console.log(`[INGEST] ✅ Episode ${episodeNumber} saved successfully`);
            result.processed++;
            result.episodes.push(`ep_${episodeNumber}: ${analysisResult.episodeTitle}`);

        } catch (err: any) {
            const msg = `ep_${episodeNumber} (${video.videoId}): ${err.message}`;
            console.error(`[INGEST] ❌ Failed: ${msg}`);
            result.failed++;
            result.errors.push(msg);
            // Continue to next video rather than aborting the whole run
        }
    }

    console.log(`[INGEST] Run complete — processed: ${result.processed}, skipped: ${result.skipped}, failed: ${result.failed}`);
    return result;
}
