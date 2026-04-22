import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { GoogleGenAI, Type, FileState } from '@google/genai';
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

// Finds the first transcript mention of a contestant that is NOT part of the
// opening promo montage. The promo rapidly lists many names in sequence —
// detected by counting how many other contestant names appear within a 30s
// window. If more than 3 appear nearby, the mention is in the promo and is
// skipped. This avoids the 600s fixed offset which breaks early contestants.
//
// nameAliases: additional spellings to match (e.g. ASR phonetic variants like
// "Hodge" for "Hajj"). Built by buildTranscriptAliasMap before the main loop.
export function findContestantTimestamp(
    segments:    SuperdataSegment[],
    name:        string,
    allNames:    string[] = [],
    nameAliases: string[] = [],
): number | null {
    const firstName   = name.split(' ')[0].toLowerCase();
    const searchTerms = [...new Set([firstName, ...nameAliases.map(a => a.toLowerCase())])];
    const otherFirstNames = allNames
        .map(n => n.split(' ')[0].toLowerCase())
        .filter(n => n !== firstName);

    for (const seg of segments) {
        const segText = seg.text.toLowerCase();
        if (!searchTerms.some(term => segText.includes(term))) continue;

        if (otherFirstNames.length > 0) {
            const windowMs   = 30_000;
            const nearbyText = segments
                .filter(s => Math.abs(s.offset - seg.offset) <= windowMs)
                .map(s => s.text.toLowerCase())
                .join(' ');
            const nearbyNameCount = otherFirstNames.filter(n => nearbyText.includes(n)).length;
            if (nearbyNameCount > 3) continue; // promo cluster — skip
        }

        return seg.offset / 1000;
    }

    return null;
}

// Finds the timestamp of Arlette's "why did you pop?" conversation with a
// Lineup member who self-eliminated. This is the best individual close-up for
// a popped Lineup member — Arlette approaches them alone at their position.
//
// Strategy: find the first mention of their name (after the intro) that appears
// near a pop-related phrase within a ±90s window. If popReason is provided it
// is used as an additional signal. Falls back to any post-intro mention.
//
// nameAliases: ASR phonetic variants — same as findContestantTimestamp.
export function findPopConversationTimestamp(
    segments:    SuperdataSegment[],
    name:        string,
    popReason?:  string,
    nameAliases: string[] = [],
): number | null {
    const firstName   = name.split(' ')[0].toLowerCase();
    const searchTerms = [...new Set([firstName, ...nameAliases.map(a => a.toLowerCase())])];
    const popPhrases  = ['why did you pop', 'why you pop', 'you popped', 'did you pop'];
    const windowMs    = 90_000;

    for (const seg of segments) {
        if (seg.offset <= 120_000) continue; // skip first 2 min
        if (!searchTerms.some(term => seg.text.toLowerCase().includes(term))) continue;

        const nearbyText = segments
            .filter(s => Math.abs(s.offset - seg.offset) <= windowMs)
            .map(s => s.text.toLowerCase())
            .join(' ');

        if (!popPhrases.some(p => nearbyText.includes(p))) continue;

        if (popReason) {
            const keyWords  = popReason.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const hasReason = keyWords.some(w => nearbyText.includes(w));
            if (!hasReason) continue;
        }

        return seg.offset / 1000;
    }

    // Fallback: first post-intro mention with no pop-phrase requirement
    for (const seg of segments) {
        if (seg.offset <= 120_000) continue;
        if (searchTerms.some(term => seg.text.toLowerCase().includes(term))) return seg.offset / 1000;
    }

    return null;
}

// Returns all match-reveal timestamps in the episode, sorted ascending.
export function findAllRevealTimestamps(segments: SuperdataSegment[]): number[] {
    // "Is it a yes for you" is specific to Arlette's final-question script and
    // does not appear in app promos or generic match references — use it as the
    // sole trigger so we get exactly N timestamps for N couples.
    const seen = new Set<number>();
    const reveals: number[] = [];

    for (const s of segments) {
        if (s.offset <= 600_000) continue; // skip first 10 min (promos/intro)
        if (s.text.toLowerCase().includes('is it a yes for you')) {
            // 3-minute bucket collapses the two "is it a yes" lines per reveal
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
// Gemini video identification: upload a 30s segment, ask Gemini to find the
// named person and return the best offset (seconds into the clip) where they
// are most clearly visible as the primary subject.
//
// Uses gemini-2.0-flash (fast + cheap) since this is an identification task,
// not a high-fidelity analysis. Falls back gracefully if upload fails.
// ---------------------------------------------------------------------------

export interface SubjectLocation {
    offsetSec:  number;               // seconds into the segment (0–30)
    found:      boolean;
    confidence: 'high' | 'medium' | 'low';
}

export async function identifySubjectInSegment(
    segmentPath: string,
    name:        string,
    role:        string,
): Promise<SubjectLocation> {
    const fallback: SubjectLocation = { offsetSec: 15, found: false, confidence: 'low' };
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    let uploadedFile: Awaited<ReturnType<typeof ai.files.upload>> | undefined;

    try {
        console.log(`  [GEMINI-ID] Uploading segment for ${name}...`);
        uploadedFile = await ai.files.upload({
            file:   segmentPath,
            config: { mimeType: 'video/mp4', displayName: `${name.replace(/\s+/g, '_')}_seg` },
        });

        // Poll until the file is processed
        let fileInfo = await ai.files.get({ name: uploadedFile.name! });
        while (fileInfo.state === FileState.PROCESSING) {
            await new Promise(r => setTimeout(r, 2_000));
            fileInfo = await ai.files.get({ name: uploadedFile.name! });
        }
        if (fileInfo.state !== FileState.ACTIVE) {
            console.warn(`  [GEMINI-ID] File processing failed for ${name} — using fallback`);
            return fallback;
        }

        const roleDesc = role === 'Lineup'
            ? 'a Lineup member who stands on the right side holding a balloon against a white background'
            : 'a Contestant (Seeker) who walks in from the left to face the Lineup';

        const response = await (ai.models.generateContent as any)({
            model:    'gemini-3-flash-preview',
            contents: [
                {
                    parts: [
                        { fileData: { mimeType: 'video/mp4', fileUri: fileInfo.uri } },
                        {
                            text: `This is a 30-second clip from the dating show "Pop the Balloon". Use BOTH the audio and video tracks.

Show format:
- Lineup members hold balloons on the RIGHT side of the frame against a white background
- Contestants (Seekers) enter from the LEFT
- The host Arlette stands CENTER during key moments

You are looking for "${name}", who is ${roleDesc}.

STEP 1 — AUDIO (primary anchor): Listen for the name "${name}" being spoken — either Arlette calling their name or the person introducing themselves. Watch whose lips are moving when that name is spoken or when that person speaks back. This is your primary way to identify them.

STEP 2 — VISUAL (best frame): Once you have identified the person via audio/lip-sync, find the moment in the clip where they are most clearly the primary subject — facing camera, well-lit, not blocked by others.

Return JSON only:
{
  "offsetSec": <seconds into clip, 0-30, where the target is best framed>,
  "found": <true if you identified them via audio or visual>,
  "confidence": <"high" if confirmed by audio lip-sync, "medium" if visual only, "low" if uncertain>
}`,
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        offsetSec:  { type: Type.NUMBER },
                        found:      { type: Type.BOOLEAN },
                        confidence: { type: Type.STRING },
                    },
                    required: ['offsetSec', 'found', 'confidence'],
                },
            },
        });

        const raw = JSON.parse(response.text ?? '{}');
        const result: SubjectLocation = {
            offsetSec:  Math.max(0, Math.min(29, Number(raw.offsetSec) || 15)),
            found:      Boolean(raw.found),
            confidence: (['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low') as SubjectLocation['confidence'],
        };

        console.log(`  [GEMINI-ID] ${name}: offset=${result.offsetSec}s  found=${result.found}  confidence=${result.confidence}`);
        return result;

    } catch (err: any) {
        console.warn(`  [GEMINI-ID] Error for ${name}: ${err.message} — using fallback`);
        return fallback;
    } finally {
        if (uploadedFile?.name) {
            await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
        }
    }
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
