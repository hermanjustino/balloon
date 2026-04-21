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

import { getTimestampedSegments, findContestantTimestamp, findMatchAnnouncementTimestamp, findAllRevealTimestamps } from '../vision';

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

function fetchFrames(videoUrl: string, startSec: number, tempDir: string, role: string): void {
    const nodePath   = process.execPath;
    const endSec     = startSec + 30;
    const cookiesArg = process.env.YTDLP_COOKIES ? `--cookies "${process.env.YTDLP_COOKIES}"` : '';
    const segPath    = path.join(tempDir, 'segment.mp4');

    // Seeker (Contestant) stands on the left; lineup members stand on the right
    const cropFilter = role === 'Lineup'
        ? 'crop=iw/2:ih:iw/2:0'  // right half
        : 'crop=iw/2:ih:0:0';    // left half

    console.log(`  [yt-dlp] Downloading segment ${startSec}s–${endSec}s...`);
    execSync(
        `${YTDLP_PATH} --js-runtimes "node:${nodePath}" ${cookiesArg}` +
        ` --download-sections "*${startSec}-${endSec}"` +
        ` -f "best[height<=720]" -o "${segPath}" "${videoUrl}"`,
        { timeout: 180_000, stdio: 'pipe' }
    );

    console.log(`  [ffmpeg] Extracting frames (${cropFilter})...`);
    execSync(
        `ffmpeg -i "${segPath}" -t 30 -vf "fps=1/5,${cropFilter}" -q:v 2 "${path.join(tempDir, 'frame_%03d.jpg')}" -y`,
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

    // 3. Build partner name map (contestantId → partner's name) for match-reveal lookup
    const couplesSnap = await db.collection('couples').where('episodeId', '==', episodeId).get();
    const partnerNameOf = new Map<string, string>();
    const idToName      = new Map(snap.docs.map(d => [d.id, d.data().name as string]));
    for (const coupleDoc of couplesSnap.docs) {
        const { contestant1Id: c1, contestant2Id: c2 } = coupleDoc.data() as { contestant1Id?: string; contestant2Id?: string };
        if (c1 && c2) {
            if (idToName.has(c2)) partnerNameOf.set(c1, idToName.get(c2)!);
            if (idToName.has(c1)) partnerNameOf.set(c2, idToName.get(c1)!);
        }
    }

    // 4. Timestamped transcript (one call for the whole episode)
    console.log('[PREFETCH] Fetching timestamped transcript...');
    const segments = await getTimestampedSegments(videoUrl);
    console.log(`[PREFETCH] ${segments.length} segments\n`);

    // Pass 1: resolve match-reveal timestamps for matched contestants via name lookup.
    // Pass 2: any matched contestant still unresolved gets the next unclaimed reveal
    //         (process of elimination — N couples = N reveals).
    const allReveals     = findAllRevealTimestamps(segments);
    const claimedReveals = new Set<number>();
    const revealOf       = new Map<string, number>(); // docId → reveal timestamp

    for (const doc of snap.docs) {
        const c         = doc.data();
        const isMatched = (c.outcome as string | undefined) === 'Matched';
        if (!isMatched) continue;

        const partnerName = partnerNameOf.get(doc.id);
        const ts = findMatchAnnouncementTimestamp(segments, c.name as string, partnerName);
        if (ts !== null) {
            revealOf.set(doc.id, ts);
            claimedReveals.add(ts);
        }
    }

    // Pass 2: assign leftover reveals to unresolved matched contestants
    const unclaimedReveals = allReveals.filter(ts => !claimedReveals.has(ts));
    let revealIdx = 0;
    for (const doc of snap.docs) {
        const c         = doc.data();
        const isMatched = (c.outcome as string | undefined) === 'Matched';
        if (!isMatched || revealOf.has(doc.id)) continue;
        if (revealIdx < unclaimedReveals.length) {
            revealOf.set(doc.id, unclaimedReveals[revealIdx++]);
        }
    }

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

        // Find timestamp
        const timestamp = findContestantTimestamp(segments, c.name as string);
        if (!timestamp) {
            console.log('⚠️  name not found in transcript — skipping');
            skipped++;
            continue;
        }

        const role      = (c.role as string | undefined) ?? 'Lineup';
        const isMatched = (c.outcome as string | undefined) === 'Matched';

        let frameTimestamp: number;

        if (isMatched) {
            // Use the final-question / match reveal segment — both are on stage together.
            // Seeker stands LEFT of Arlette, lineup member stands RIGHT.
            const matchTs = revealOf.get(doc.id) ?? null;
            if (matchTs !== null) {
                const via = claimedReveals.has(matchTs) && revealOf.get(doc.id) === matchTs
                    ? 'name-match' : 'elimination';
                frameTimestamp = matchTs;
                console.log(`match-reveal at ${matchTs.toFixed(0)}s [${via}]  role: ${role}`);
            } else {
                frameTimestamp = timestamp;
                console.log(`match-reveal not found, using first-mention ${timestamp.toFixed(0)}s  role: ${role}`);
            }
        } else {
            // TODO: implement per-role framing for non-matched contestants.
            // Lineup members appear in the balloon row (right side) during their intro segment.
            // Seekers walk in from the left at the start of their round.
            // For now use first-mention as a placeholder so GCS has something.
            frameTimestamp = timestamp;
            console.log(`first-mention ${timestamp.toFixed(0)}s  role: ${role} (non-matched placeholder)`);
        }

        const startSec = Math.max(0, frameTimestamp);
        const tempDir  = fs.mkdtempSync(path.join(os.tmpdir(), `balloon_prefetch_`));

        try {
            fetchFrames(videoUrl, startSec, tempDir, role);

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
