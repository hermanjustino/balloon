/**
 * GENERATE CARDS SCRIPT
 *
 * Finds matched contestants for an episode, runs vision analysis + Imagen
 * avatar generation, and renders trading card PNGs.
 *
 * Usage:
 *   GEMINI_API_KEY=... SUPADATA_API_KEY=... npx ts-node src/scripts/generate_cards.ts [ep_N]
 *
 * If no episode ID is given, the script picks the earliest episode that has
 * matched couples in Firestore.
 *
 * Output: ./output_cards/{episodeId}_{name}.png
 */

import * as admin from 'firebase-admin';
import * as fs    from 'fs';
import * as path  from 'path';
import * as os    from 'os';

import {
    getTimestampedSegments,
    runVisionAnalysis,
    downloadFramesFromGCS,
    analyzeFramesWithGemini,
    VisionTraits,
} from '../vision';
import { renderCard, CardData } from '../card-renderer';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: process.env.PROJECT_ID || 'balloon-87473' });
}
const db = admin.firestore();

const OUTPUT_DIR = path.join(process.cwd(), 'output_cards');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function slug(name: string) {
    return name.replace(/[^a-z0-9]/gi, '_');
}

// ---------------------------------------------------------------------------
// Find earliest episode that has matched couples
// ---------------------------------------------------------------------------

async function findEarliestEpisodeWithMatches(): Promise<string> {
    const snap = await db.collection('couples').limit(300).get();

    const byEpisode = new Map<string, number>();
    for (const doc of snap.docs) {
        const ep = (doc.data().episodeId as string | undefined) || 'unknown';
        byEpisode.set(ep, (byEpisode.get(ep) ?? 0) + 1);
    }

    const sorted = [...byEpisode.keys()].sort((a, b) => {
        const na = parseInt(a.replace(/\D+/g, ''), 10) || 9999;
        const nb = parseInt(b.replace(/\D+/g, ''), 10) || 9999;
        return na - nb;
    });

    if (!sorted.length) throw new Error('No episodes with couples found in Firestore');
    return sorted[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const episodeId = process.argv[2] ?? await findEarliestEpisodeWithMatches();
    console.log(`\n[CARDS] ══════════════════════════════════`);
    console.log(`[CARDS] Episode: ${episodeId}`);
    console.log(`[CARDS] Output:  ${OUTPUT_DIR}`);
    console.log(`[CARDS] ══════════════════════════════════\n`);

    // 1. Load analysis (video URL, episode metadata)
    const analysisDoc = await db.collection('analyses').doc(episodeId).get();
    if (!analysisDoc.exists) throw new Error(`No analysis document for ${episodeId}`);
    const analysis  = analysisDoc.data()!;
    const videoUrl  = analysis.videoUrl as string;
    const epNumber  = (analysis.episodeNumber ?? episodeId.replace('ep_', '')) as string;
    const epTitle   = (analysis.episodeTitle ?? '') as string;

    console.log(`[CARDS] Title: ${epTitle}`);
    console.log(`[CARDS] Video: ${videoUrl}\n`);

    // 2. Load matched couples for this episode
    const couplesSnap = await db.collection('couples')
        .where('episodeId', '==', episodeId)
        .get();

    if (couplesSnap.empty) throw new Error(`No couples found for ${episodeId}`);
    console.log(`[CARDS] ${couplesSnap.size} matched couple(s) found\n`);

    // 3. Get timestamped transcript once (shared across all contestants)
    console.log('[CARDS] Fetching timestamped transcript from Supadata...');
    const segments = await getTimestampedSegments(videoUrl);
    console.log(`[CARDS] ${segments.length} transcript segments loaded\n`);

    // 4. Collect unique contestant IDs and build partner name lookup
    const contestantIds = new Set<string>();
    // partnerIdOf[id] = the other person's contestant ID
    const partnerIdOf = new Map<string, string>();
    for (const doc of couplesSnap.docs) {
        const d = doc.data();
        const c1 = d.contestant1Id as string | undefined;
        const c2 = d.contestant2Id as string | undefined;
        if (c1) contestantIds.add(c1);
        if (c2) contestantIds.add(c2);
        if (c1 && c2) { partnerIdOf.set(c1, c2); partnerIdOf.set(c2, c1); }
    }

    // Resolve partner IDs → names
    const partnerNameOf = new Map<string, string>();
    for (const [id, partnerId] of partnerIdOf) {
        const pDoc = await db.collection('contestants').doc(partnerId).get();
        if (pDoc.exists) partnerNameOf.set(id, pDoc.data()!.name as string);
    }

    // 5. Process each matched contestant
    for (const contestantId of contestantIds) {
        const cDoc = await db.collection('contestants').doc(contestantId).get();
        if (!cDoc.exists) {
            console.warn(`[CARDS] Contestant not found: ${contestantId} — skipping`);
            continue;
        }

        const contestant = cDoc.data()!;
        const name       = contestant.name as string;

        console.log(`[CARDS] ─── ${name} ───────────────────────────`);

        const cardPath = path.join(OUTPUT_DIR, `${episodeId}_${slug(name)}.png`);

        // 5a. Vision analysis
        // Route: GCS pre-fetched frames (preferred) → yt-dlp live fetch (fallback)
        let visionTraits: VisionTraits | undefined;
        let bestFramePath: string | undefined;
        let tempDir: string | undefined;

        const hasPrefetch = contestant.framesPrefetched && contestant.framesGcsPrefix;

        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `balloon_vision_${slug(name)}_`));

            let framePaths: string[];

            if (hasPrefetch) {
                console.log(`[CARDS] Downloading pre-fetched frames from GCS...`);
                framePaths = await downloadFramesFromGCS(contestant.framesGcsPrefix as string, tempDir);
            } else {
                console.log(`[CARDS] No pre-fetched frames — attempting live yt-dlp fetch...`);
                const result = await runVisionAnalysis(contestant as { name: string }, videoUrl, segments);
                framePaths    = [];
                visionTraits  = result.traits;
                bestFramePath = result.bestFramePath ?? undefined;
                fs.rmSync(tempDir, { recursive: true, force: true });
                tempDir = result.tempDir;
            }

            if (framePaths.length > 0) {
                // Pin bestFramePath before vision so the frame survives a Gemini failure
                bestFramePath = framePaths[Math.floor(framePaths.length / 2)] ?? framePaths[0];
                try {
                    visionTraits = await analyzeFramesWithGemini(framePaths);
                    console.log(`[CARDS] Vision →`, JSON.stringify(visionTraits, null, 2));
                    await cDoc.ref.update({ vision: visionTraits });
                } catch (visionErr: any) {
                    console.warn(`[CARDS] Vision failed for ${name}: ${visionErr.message}`);
                }
            }

        } catch (err: any) {
            console.warn(`[CARDS] Frame download failed for ${name}: ${err.message}`);
            if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
            tempDir = undefined;
        }

        // 5b. Render trading card
        const cardData: CardData = {
            name,
            age:           contestant.age   as string ?? 'Unknown',
            job:           (contestant.job  as string | undefined)
                           ?? (contestant.jobs as string[] | undefined)?.[0]
                           ?? '',
            city:          (contestant.location as any)?.city  ?? '',
            state:         (contestant.location as any)?.state ?? '',
            gender:        contestant.gender  as string | undefined,
            outcome:       contestant.outcome as string ?? 'Unknown',
            matchedWith:   partnerNameOf.get(contestantId),
            popReason:     contestant.popReason as string | undefined,
            hasKids:       (contestant.kids as any)?.hasKids  as boolean | undefined,
            kidsCount:     (contestant.kids as any)?.count    as number  | undefined,
            episodeNumber: epNumber,
            episodeTitle:  epTitle,
            avatarPath:    undefined,
            framePath:     bestFramePath,
            vision:        visionTraits,
        };

        await renderCard(cardData, cardPath);
        console.log(`[CARDS] ✅ Card: ${cardPath}\n`);

        // Clean up temporary frame files
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    console.log(`[CARDS] ══════════════════════════════════`);
    console.log(`[CARDS] Done! All cards in: ${OUTPUT_DIR}`);
    process.exit(0);
}

main().catch(err => {
    console.error('[CARDS] Fatal:', err.message);
    process.exit(1);
});
