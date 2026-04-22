/**
 * PREFETCH FRAMES — run this locally (residential IP required)
 *
 * For each contestant in an episode:
 *   1. Find their first-mention timestamp in the Supadata transcript
 *   2. Download a 30-second video segment via yt-dlp (uses local residential IP)
 *   3. Extract 6 frames with ffmpeg
 *   4. Upload frames to Cloud Storage: frames/{episodeId}/{contestantId}/frame_NNN.jpg
 *   5. Mark contestant.framesPrefetched = true in Firestore
 *
 * After this runs locally, generate_cards.ts can be run anywhere (Cloud Run,
 * CI, another machine) — it will pull frames from GCS instead of YouTube.
 *
 * Usage:
 *   npx ts-node src/scripts/prefetch_frames.ts <episodeId>
 *   npx ts-node src/scripts/prefetch_frames.ts ep_75
 *
 * Optional env vars:
 *   YTDLP_COOKIES   path to a Netscape-format cookies file (rarely needed locally)
 *   FORCE_REFETCH   set to "true" to re-download even if frames already exist in GCS
 */

import * as admin from 'firebase-admin';
import { Storage }  from '@google-cloud/storage';
import * as fs      from 'fs';
import * as path    from 'path';
import * as os      from 'os';
import { execSync } from 'child_process';

import { getTimestampedSegments, findContestantTimestamp, findPopConversationTimestamp, identifySubjectInSegment } from '../vision';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ID  = process.env.PROJECT_ID  || 'balloon-87473';
const BUCKET_NAME = process.env.GCS_BUCKET  || 'balloon-87473.firebasestorage.app';
const YTDLP_PATH  = process.env.YTDLP_PATH  || 'yt-dlp';
const FORCE       = process.env.FORCE_REFETCH === 'true';

if (admin.apps.length === 0) admin.initializeApp({ projectId: PROJECT_ID });
const db      = admin.firestore();
const storage = new Storage({ projectId: PROJECT_ID });
const bucket  = storage.bucket(BUCKET_NAME);

// ---------------------------------------------------------------------------
// GCS helpers
// ---------------------------------------------------------------------------

async function framesExist(gcsPrefix: string): Promise<boolean> {
    const [files] = await bucket.getFiles({ prefix: gcsPrefix });
    return files.some(f => f.name.endsWith('.jpg'));
}

async function uploadDir(localDir: string, gcsPrefix: string): Promise<number> {
    const files = fs.readdirSync(localDir).filter(f => f.endsWith('.jpg')).sort();
    for (const file of files) {
        await bucket.upload(path.join(localDir, file), {
            destination: `${gcsPrefix}${file}`,
            metadata: { contentType: 'image/jpeg' },
        });
    }
    return files.length;
}

// ---------------------------------------------------------------------------
// Frame extraction (local, residential IP)
// ---------------------------------------------------------------------------

function downloadSegment(videoUrl: string, startSec: number, tempDir: string): string {
    const nodePath   = process.execPath;
    const endSec     = startSec + 30;
    const cookiesArg = process.env.YTDLP_COOKIES ? `--cookies "${process.env.YTDLP_COOKIES}"` : '';
    const segPath    = path.join(tempDir, 'segment.mp4');

    console.log(`  [yt-dlp] Downloading segment ${startSec}s–${endSec}s...`);
    execSync(
        `${YTDLP_PATH} --js-runtimes "node:${nodePath}" ${cookiesArg}` +
        ` --download-sections "*${startSec}-${endSec}"` +
        ` -f "best[height<=720]" -o "${segPath}" "${videoUrl}"`,
        { timeout: 180_000, stdio: 'pipe' }
    );

    return segPath;
}

function extractFramesFromSegment(segPath: string, offsetSec: number, tempDir: string): void {
    // Extract 6 frames in a 6-second window around the identified offset
    const startAt = Math.max(0, offsetSec - 3);
    console.log(`  [ffmpeg] Extracting frames at offset ${offsetSec.toFixed(1)}s...`);
    execSync(
        `ffmpeg -i "${segPath}" -ss ${startAt} -t 6 -vf "fps=1" -q:v 2 "${path.join(tempDir, 'frame_%03d.jpg')}" -y`,
        { timeout: 30_000, stdio: 'pipe' }
    );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const episodeId = process.argv[2];
    if (!episodeId) {
        console.error('Usage: npx ts-node src/scripts/prefetch_frames.ts <episodeId>');
        process.exit(1);
    }

    console.log(`\n[PREFETCH] Episode: ${episodeId}  bucket: ${BUCKET_NAME}\n`);

    // 1. Load analysis (video URL)
    const analysisDoc = await db.collection('analyses').doc(episodeId).get();
    if (!analysisDoc.exists) throw new Error(`No analysis for ${episodeId}`);
    const videoUrl = analysisDoc.data()!.videoUrl as string;
    console.log(`[PREFETCH] Video: ${videoUrl}\n`);

    // 2. All contestants for this episode
    const snap = await db.collection('contestants')
        .where('episodeId', '==', episodeId)
        .get();
    console.log(`[PREFETCH] ${snap.size} contestant(s) found\n`);

    // 3. Timestamped transcript (one call for the whole episode)
    console.log('[PREFETCH] Fetching timestamped transcript...');
    const segments = await getTimestampedSegments(videoUrl);
    console.log(`[PREFETCH] ${segments.length} segments\n`);

    const allNames = snap.docs.map(d => d.data().name as string);

    let done = 0, skipped = 0, failed = 0;

    for (const doc of snap.docs) {
        const c          = doc.data();
        const gcsPrefix  = `frames/${episodeId}/${doc.id}/`;

        process.stdout.write(`[PREFETCH] ${c.name} ... `);

        // Skip if already prefetched (unless FORCE)
        if (!FORCE && c.framesPrefetched) {
            console.log('already marked — skipping (set FORCE_REFETCH=true to re-fetch)');
            skipped++;
            continue;
        }

        if (!FORCE && await framesExist(gcsPrefix)) {
            await doc.ref.update({ framesPrefetched: true, framesGcsPrefix: gcsPrefix });
            console.log('frames exist in GCS, marked in Firestore');
            skipped++;
            continue;
        }

        const role    = (c.role    as string | undefined) ?? 'Lineup';
        const outcome = (c.outcome as string | undefined) ?? '';
        const isPopped = outcome === 'Popped' && role === 'Lineup';

        let frameTimestamp: number;

        if (isPopped) {
            // Lineup member who self-eliminated: Arlette's "why did you pop?"
            // conversation is the cleanest individual close-up for this person.
            const popTs = findPopConversationTimestamp(
                segments,
                c.name as string,
                c.popReason as string | undefined,
            );
            if (popTs !== null) {
                frameTimestamp = popTs;
                console.log(`pop-conversation at ${popTs.toFixed(0)}s  role: ${role}`);
            } else {
                const ts = findContestantTimestamp(segments, c.name as string, allNames);
                if (!ts) { console.log('⚠️  name not found in transcript — skipping'); skipped++; continue; }
                frameTimestamp = ts;
                console.log(`pop-conversation not found, using first-mention ${ts.toFixed(0)}s  role: ${role}`);
            }
        } else {
            // Everyone else — Seekers, matched and non-matched Lineup members:
            // first isolated name mention after the promo (name-density guard).
            // This gives a solo shot of just that person, not a two-person reveal frame.
            const ts = findContestantTimestamp(segments, c.name as string, allNames);
            if (!ts) { console.log('⚠️  name not found in transcript — skipping'); skipped++; continue; }
            frameTimestamp = ts;
            console.log(`first-mention ${ts.toFixed(0)}s  role: ${role}  outcome: ${outcome}`);
        }

        const startSec = Math.max(0, frameTimestamp);
        const tempDir  = fs.mkdtempSync(path.join(os.tmpdir(), `balloon_prefetch_`));

        try {
            const segPath = downloadSegment(videoUrl, startSec, tempDir);

            // Ask Gemini to identify where the named person is most clearly
            // visible within the 30s segment, then extract frames at that offset.
            const { offsetSec, found, confidence } = await identifySubjectInSegment(
                segPath,
                c.name as string,
                role,
            );
            const bestOffset = (found && confidence !== 'low') ? offsetSec : 15;

            extractFramesFromSegment(segPath, bestOffset, tempDir);

            const count = await uploadDir(tempDir, gcsPrefix);
            await doc.ref.update({
                framesPrefetched: true,
                framesGcsPrefix:  gcsPrefix,
                framesUploadedAt: new Date().toISOString(),
            });

            console.log(`  ✅ ${count} frames → gs://${BUCKET_NAME}/${gcsPrefix}`);
            done++;
        } catch (err: any) {
            console.log(`  ❌ ${err.message}`);
            failed++;
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    console.log(`\n[PREFETCH] Done — fetched: ${done}, skipped: ${skipped}, failed: ${failed}`);
    console.log(`[PREFETCH] Now run generate_cards.ts from anywhere.\n`);
    process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
