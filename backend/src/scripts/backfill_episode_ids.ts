/**
 * MIGRATION: Backfill UUID-keyed analyses to ep_N format
 *
 * Some older episodes were analyzed before the deterministic ep_N ID format
 * was introduced. Their analyses, contestants, couples, and transcripts are
 * all keyed by a random UUID instead of ep_<number>.
 *
 * For each UUID-keyed analyses doc that has an episodeNumber, this script:
 *   1. Creates the ep_N analyses document (if not already there)
 *   2. Copies the transcript to the ep_N key (if any)
 *   3. Updates contestants: episodeId, episodeNumber, episodeTitle
 *   4. Updates couples: episodeId
 *   5. Deletes the old UUID-keyed analyses and transcript documents
 *
 * Safe to re-run: skips docs where ep_N exists AND no contestants reference the UUID.
 * Resumes partial migrations: if ep_N exists but contestants still reference the UUID,
 * it finishes the job.
 *
 * Run from backend/ (dry run first):
 *   npx ts-node src/scripts/backfill_episode_ids.ts
 *
 * Apply changes:
 *   DRY_RUN=false npx ts-node src/scripts/backfill_episode_ids.ts
 */

import * as admin from 'firebase-admin';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const PROJECT_ID = 'balloon-87473';

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

async function updateInBatches(
    docs: admin.firestore.QueryDocumentSnapshot[],
    updates: Record<string, any>
) {
    for (let i = 0; i < docs.length; i += 400) {
        const batch = db.batch();
        docs.slice(i, i + 400).forEach(d => batch.update(d.ref, updates));
        await batch.commit();
    }
}

async function run() {
    console.log(`=== EPISODE ID BACKFILL (DRY_RUN=${DRY_RUN}) ===\n`);

    const snap = await db.collection('analyses').get();
    const allDocs = snap.docs.map(d => ({ id: d.id, data: d.data() as any }));

    const uuidDocs = allDocs.filter(d => !d.id.startsWith('ep_'));
    const epDocIds = new Set(allDocs.filter(d => d.id.startsWith('ep_')).map(d => d.id));

    // Separate UUID docs into migratable and skipped (no episodeNumber)
    const toMigrate = uuidDocs.filter(d => !!d.data.episodeNumber);
    const noEpNum = uuidDocs.filter(d => !d.data.episodeNumber);

    console.log(`Total analyses:     ${allDocs.length}`);
    console.log(`UUID-keyed:         ${uuidDocs.length}`);
    console.log(`ep_N-keyed:         ${epDocIds.size}`);
    console.log(`To migrate:         ${toMigrate.length}`);
    console.log(`Skipped (no episodeNumber): ${noEpNum.length}`);

    if (noEpNum.length > 0) {
        console.log('\nUUID docs with no episodeNumber (will not be migrated):');
        noEpNum.forEach(d => console.log(`  ${d.id}`));
    }

    if (toMigrate.length === 0) {
        console.log('\nNothing to migrate.');
        process.exit(0);
    }

    console.log('');

    let migratedAnalyses = 0;
    let migratedContestants = 0;
    let migratedCouples = 0;
    let migratedTranscripts = 0;
    let cleanedUp = 0;

    for (const doc of toMigrate) {
        const oldId = doc.id;
        const epNum = String(doc.data.episodeNumber);
        const newId = `ep_${epNum}`;
        const epTitle: string | null = doc.data.episodeTitle || null;

        console.log(`[${oldId}] → [${newId}]`);

        const [contestantsSnap, couplesSnap, transcriptSnap] = await Promise.all([
            db.collection('contestants').where('episodeId', '==', oldId).get(),
            db.collection('couples').where('episodeId', '==', oldId).get(),
            db.collection('transcripts').doc(oldId).get(),
        ]);

        const epNExists = epDocIds.has(newId);

        // Fully migrated: ep_N exists and nothing still references the old UUID
        if (epNExists && contestantsSnap.size === 0 && couplesSnap.size === 0) {
            console.log(`  Already migrated — cleaning up old UUID doc`);
            if (!DRY_RUN) {
                if (transcriptSnap.exists) await db.collection('transcripts').doc(oldId).delete();
                await db.collection('analyses').doc(oldId).delete();
            }
            cleanedUp++;
            continue;
        }

        if (epNExists) {
            console.log(`  NOTE: ep_N doc already exists — resuming partial migration`);
        }

        console.log(`  contestants: ${contestantsSnap.size}`);
        console.log(`  couples:     ${couplesSnap.size}`);
        console.log(`  transcript:  ${transcriptSnap.exists ? 'found' : 'none'}`);

        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would create analyses/${newId}, update ${contestantsSnap.size} contestants + ${couplesSnap.size} couples, delete analyses/${oldId}`);
        } else {
            // 1. Create ep_N analyses doc (only if not already there)
            if (!epNExists) {
                await db.collection('analyses').doc(newId).set({
                    ...doc.data,
                    episodeId: newId,
                });
            }

            // 2. Copy transcript if it exists (skip if ep_N transcript already there)
            if (transcriptSnap.exists) {
                const newTranscriptSnap = await db.collection('transcripts').doc(newId).get();
                if (!newTranscriptSnap.exists) {
                    await db.collection('transcripts').doc(newId).set(transcriptSnap.data()!);
                }
                await db.collection('transcripts').doc(oldId).delete();
                migratedTranscripts++;
            }

            // 3. Update contestants: episodeId + episodeNumber + episodeTitle for display
            const contestantUpdates: Record<string, any> = { episodeId: newId };
            if (epNum) contestantUpdates.episodeNumber = epNum;
            if (epTitle) contestantUpdates.episodeTitle = epTitle;
            await updateInBatches(contestantsSnap.docs, contestantUpdates);

            // 4. Update couples: same fields as contestants for schema consistency
            const coupleUpdates: Record<string, any> = { episodeId: newId };
            if (epNum) coupleUpdates.episodeNumber = epNum;
            if (epTitle) coupleUpdates.episodeTitle = epTitle;
            await updateInBatches(couplesSnap.docs, coupleUpdates);

            // 5. Delete old UUID analyses doc
            await db.collection('analyses').doc(oldId).delete();

            console.log(`  ✓ Done`);
        }

        migratedAnalyses++;
        migratedContestants += contestantsSnap.size;
        migratedCouples += couplesSnap.size;
    }

    console.log('\n=== SUMMARY ===');
    const verb = DRY_RUN ? '[DRY RUN] Would migrate' : 'Migrated';
    console.log(`${verb}:`);
    console.log(`  analyses:    ${migratedAnalyses}`);
    console.log(`  contestants: ${migratedContestants}`);
    console.log(`  couples:     ${migratedCouples}`);
    console.log(`  transcripts: ${migratedTranscripts}`);
    if (cleanedUp > 0) console.log(`  already-done cleanups: ${cleanedUp}`);

    if (DRY_RUN) {
        console.log('\nRun with DRY_RUN=false to apply changes.');
    } else {
        console.log('\nDone. BigQuery will reflect the change after the next Firebase extension sync.');
    }

    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
