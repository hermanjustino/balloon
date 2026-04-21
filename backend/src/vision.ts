import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { GoogleGenAI, Type } from '@google/genai';
import { Storage } from '@google-cloud/storage';

const SUPADATA_API_BASE = 'https://api.supadata.ai/v1';
const SUPADATA_API_KEY  = process.env.SUPADATA_API_KEY || '';
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || '';
const YTDLP_PATH        = process.env.YTDLP_PATH || 'yt-dlp';
const PROJECT_ID        = process.env.PROJECT_ID  || 'balloon-87473';
const BUCKET_NAME       = process.env.GCS_BUCKET  || 'balloon-87473.firebasestorage.app';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuperdataSegment {
    lang:     string;
    text:     string;
    offset:   number; // milliseconds
    duration: number; // milliseconds
}

export interface VisionTraits {
    hairColor:        string;
    hairStyle:        string;
    fashionStyle:     string;
    bodyType:         string;
    framesAnalyzed:   number;
    visionAnalyzedAt: string;
}

// ---------------------------------------------------------------------------
// Supadata: timestamped transcript
// ---------------------------------------------------------------------------

export async function getTimestampedSegments(videoUrl: string): Promise<SuperdataSegment[]> {
    const apiUrl = `${SUPADATA_API_BASE}/transcript?url=${encodeURIComponent(videoUrl)}&lang=en&text=false`;
    const res = await fetch(apiUrl, { headers: { 'x-api-key': SUPADATA_API_KEY } });
    if (!res.ok) throw new Error(`Supadata error: HTTP ${res.status}`);
    const data = await res.json() as { content: SuperdataSegment[] };
    return data.content;
}

// ---------------------------------------------------------------------------
// Timestamp lookup: first-name fuzzy match
// ---------------------------------------------------------------------------

export function findContestantTimestamp(segments: SuperdataSegment[], name: string): number | null {
    const firstName = name.split(' ')[0].toLowerCase();
    const match = segments.find(s => s.text.toLowerCase().includes(firstName));
    return match ? match.offset / 1000 : null; // ms → seconds
}

// Returns all match-reveal timestamps in the episode, sorted ascending.
export function findAllRevealTimestamps(segments: SuperdataSegment[]): number[] {
    const matchPhrases = ['is it a yes for you', 'we got a match', 'come on up here', 'come on up'];
    const seen = new Set<number>();
    const reveals: number[] = [];

    for (const s of segments) {
        // Skip the first 10 minutes — early promos / app ads often contain match phrases
        if (s.offset <= 600_000) continue;
        if (matchPhrases.some(p => s.text.toLowerCase().includes(p))) {
            // 3-minute bucket: "come on up here" and "is it a yes for you" for the
            // same reveal are usually <2min apart, so they collapse into one entry
            const bucket = Math.floor(s.offset / 180_000);
            if (!seen.has(bucket)) {
                seen.add(bucket);
                reveals.push(s.offset / 1000);
            }
        }
    }

    return reveals.sort((a, b) => a - b);
}

// Finds the timestamp of Arlette's final-question segment for a matched contestant.
//
// Strategy: scan the whole transcript for reveal phrases, then identify which
// reveal belongs to this contestant by checking if their name appears within
// a ±150s window around each reveal. This handles the typical gap of 30-60
// minutes between lineup introductions and the actual match reveal.
//
// At the reveal moment the seeker stands LEFT of Arlette, lineup member RIGHT.
export function findMatchAnnouncementTimestamp(
    segments:    SuperdataSegment[],
    name:        string,
    partnerName?: string, // also accepted — some contestants don't say their own name at the reveal
): number | null {
    const names = [name, partnerName]
        .filter(Boolean)
        .map(n => n!.split(' ')[0].toLowerCase());

    const matchPhrases = ['is it a yes for you', 'we got a match', 'come on up here', 'come on up'];
    const windowMs     = 150_000; // ±150s around the reveal to look for either name

    // 1. Find all reveal moments in the episode (skip early promos at <60s)
    const revealSegments = segments.filter(s =>
        s.offset > 60_000 &&
        matchPhrases.some(p => s.text.toLowerCase().includes(p))
    );

    // 2. Pick the reveal where either contestant's name appears nearby
    for (const reveal of revealSegments) {
        const nameNearby = segments.some(s =>
            Math.abs(s.offset - reveal.offset) <= windowMs &&
            names.some(n => s.text.toLowerCase().includes(n))
        );
        if (nameNearby) return reveal.offset / 1000;
    }

    return null; // no announcement found — caller should fall back
}

// ---------------------------------------------------------------------------
// Frame extraction
//
// Strategy:
//   With PROXY_URL set (residential proxy): yt-dlp downloads a 30-second
//   segment of the video locally, then ffmpeg extracts frames from the file.
//   This keeps the YouTube request on a residential IP while ffmpeg works
//   locally — avoiding the signed-URL-to-different-IP problem.
//
//   Without PROXY_URL: falls back to direct stream URL approach (works on
//   local machines; blocked by YouTube on datacenter IPs).
// ---------------------------------------------------------------------------

export async function extractFrames(videoUrl: string, timestampSec: number, outputDir: string): Promise<string[]> {
    const startSec  = Math.max(0, timestampSec + 8);
    const endSec    = startSec + 30;
    const nodePath  = process.execPath;
    const proxyUrl  = process.env.PROXY_URL;
    const proxyArg  = proxyUrl ? `--proxy "${proxyUrl}"` : '';
    const baseFlags = `--js-runtimes "node:${nodePath}" ${proxyArg} -f "best[height<=720]"`;

    let videoSource: string; // either a local file path or a remote stream URL

    if (proxyUrl) {
        // Download just the 30-second window through the residential proxy
        const segmentPath = path.join(outputDir, 'segment.mp4');
        console.log(`[VISION] Downloading segment via proxy (${startSec}s–${endSec}s)...`);
        execSync(
            `${YTDLP_PATH} ${baseFlags} --download-sections "*${startSec}-${endSec}" -o "${segmentPath}" "${videoUrl}"`,
            { timeout: 120_000 }
        );
        videoSource = segmentPath;
    } else {
        // Get remote stream URL (works locally; blocked on datacenter IPs)
        const streamUrl = execSync(
            `${YTDLP_PATH} ${baseFlags} -g "${videoUrl}" 2>/dev/null`,
            { encoding: 'utf-8', timeout: 30_000 }
        ).trim();
        if (!streamUrl) throw new Error('yt-dlp returned empty stream URL');
        videoSource = streamUrl;
    }

    // One frame every 5s across the window → up to 6 frames
    // crop=iw/2:ih:0:0 → left half where the contestant stands (lineup is on the right)
    const outputPattern = path.join(outputDir, 'frame_%03d.jpg');
    const ffmpegSs      = proxyUrl ? 0 : startSec; // segment already starts at startSec
    execSync(
        `ffmpeg -ss ${ffmpegSs} -i "${videoSource}" -t 30 -vf "fps=1/5,crop=iw/2:ih:0:0" -q:v 2 "${outputPattern}" -y 2>/dev/null`,
        { timeout: 90_000 }
    );

    return fs.readdirSync(outputDir)
        .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
        .sort()
        .map(f => path.join(outputDir, f));
}

// ---------------------------------------------------------------------------
// GCS frame download
// Downloads pre-fetched frames from Cloud Storage to a local temp directory.
// Use this when prefetch_frames.ts has already run on a residential machine.
// ---------------------------------------------------------------------------

export async function downloadFramesFromGCS(gcsPrefix: string, outputDir: string): Promise<string[]> {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket  = storage.bucket(BUCKET_NAME);

    const [files] = await bucket.getFiles({ prefix: gcsPrefix });
    const jpgs    = files.filter(f => f.name.endsWith('.jpg')).sort((a, b) => a.name.localeCompare(b.name));

    if (jpgs.length === 0) throw new Error(`No frames found in gs://${BUCKET_NAME}/${gcsPrefix}`);

    const localPaths: string[] = [];
    for (const file of jpgs) {
        const dest = path.join(outputDir, path.basename(file.name));
        await file.download({ destination: dest });
        localPaths.push(dest);
    }

    console.log(`[VISION] Downloaded ${localPaths.length} frames from GCS`);
    return localPaths;
}

// ---------------------------------------------------------------------------
// Gemini Vision: analyse frames → structured VisionTraits
// ---------------------------------------------------------------------------

export async function analyzeFramesWithGemini(framePaths: string[]): Promise<VisionTraits> {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const frames  = framePaths.slice(0, 6);
    const imgParts = frames.map(fp => ({
        inlineData: {
            mimeType: 'image/jpeg' as const,
            data: fs.readFileSync(fp).toString('base64'),
        },
    }));

    const schema = {
        type: Type.OBJECT,
        properties: {
            hairColor:    { type: Type.STRING, description: 'Primary hair color: Black, Brown, Blonde, Red, Gray, White, Colored/Dyed' },
            hairStyle:    { type: Type.STRING, description: 'Hair style: Natural/Curly, Straight, Braids/Locs, Short, Bald, Wavy' },
            fashionStyle: { type: Type.STRING, description: 'Clothing style: Business Casual, Streetwear, Athleisure, Glam/Dressy, Smart Casual, Casual' },
            bodyType:     { type: Type.STRING, description: 'Visible build: Slim, Athletic, Average, Curvy, Stocky. Use Average when uncertain.' },
        },
        required: ['hairColor', 'hairStyle', 'fashionStyle', 'bodyType'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
            ...imgParts,
            {
                text: `These frames are from the dating show "Pop the Balloon". The balloon poles are approximately 6 feet tall — use them as a height reference. Identify the person who appears most prominently (not the host or background crowd) and extract their appearance traits. Reach a consensus across all frames.`,
            },
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        },
    } as any);

    const traits = JSON.parse(response.text ?? '{}');
    return {
        ...traits,
        framesAnalyzed:   frames.length,
        visionAnalyzedAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Orchestrator: timestamp → frames → Gemini Vision
// ---------------------------------------------------------------------------

export async function runVisionAnalysis(
    contestant: { name: string },
    videoUrl:   string,
    segments:   SuperdataSegment[]
): Promise<{ traits: VisionTraits; bestFramePath: string | null; tempDir: string }> {
    const timestamp = findContestantTimestamp(segments, contestant.name);

    if (!timestamp) {
        throw new Error(`Could not find timestamp for "${contestant.name}" in transcript`);
    }

    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `balloon_frames_${contestant.name.replace(/\s+/g, '_')}_`)
    );

    try {
        console.log(`[VISION] ${contestant.name} first mentioned at ${timestamp.toFixed(1)}s`);
        const framePaths = await extractFrames(videoUrl, timestamp, tempDir);

        if (framePaths.length === 0) throw new Error(`No frames extracted for "${contestant.name}"`);

        console.log(`[VISION] Extracted ${framePaths.length} frames, running Gemini Vision...`);
        const traits = await analyzeFramesWithGemini(framePaths);

        // Middle frame tends to be the cleanest portrait
        const bestFramePath = framePaths[Math.floor(framePaths.length / 2)] ?? framePaths[0] ?? null;

        return { traits, bestFramePath, tempDir };
    } catch (err) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw err;
    }
}
