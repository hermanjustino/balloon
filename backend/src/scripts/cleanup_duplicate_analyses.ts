/**
 * CLEANUP: Remove duplicate UUID-style analyses for episodes 75–89
 *
 * Episodes 75–89 exist in two formats:
 *   - UUID-style  (e.g. 0ce0ef39-...) from the old admin panel
 *   - ep_N-style  (e.g. ep_75)        from the automated pipeline
 *
 * We keep the ep_N-style docs (canonical) and delete the UUID-style ones,
 * along with their linked contestants, couples, and transcripts.
 *
 * Run from backend/:
 *   npx ts-node src/scripts/cleanup_duplicate_analyses.ts
 *
 * Set DRY_RUN=false to actually delete:
 *   DRY_RUN=false npx ts-node src/scripts/cleanup_duplicate_analyses.ts
 */

import * as admin from 'firebase-admin';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const PROJECT_ID = 'balloon-87473';

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

async function run() {
    console.log(`=== DUPLICATE ANALYSES CLEANUP (DRY_RUN=${DRY_RUN}) ===\n`);

    // 1. Load all analyses
    const snap = await db.collection('analyses').get();
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const uuidDocs = allDocs.filter(d => !d.id.startsWith('ep_'));
    const epDocs   = allDocs.filter(d =>  d.id.startsWith('ep_'));

    // Episode numbers present in the ep_N-style collection
    const canonicalEpNums = new Set(epDocs.map(d => String(d.episodeNumber)).filter(Boolean));

    // UUID docs whose episodeNumber is already covered by an ep_N doc → duplicates
    const duplicates = uuidDocs.filter(d => canonicalEpNums.has(String(d.episodeNumber)));

    console.log(`Total analyses:          ${allDocs.length}`);
    console.log(`UUID-style docs:         ${uuidDocs.length}`);
    console.log(`ep_N-style docs:         ${epDocs.length}`);
    console.log(`Duplicates to remove:    ${duplicates.length}\n`);

    if (duplicates.length === 0) {
        console.log('Nothing to clean up.');
        return;
    }

    console.log('Duplicates identified:');
    for (const d of duplicates) {
        console.log(`  ${d.id}  (ep ${d.episodeNumber}: ${d.episodeTitle})`);
    }
    console.log('');

    let deletedAnalyses = 0;
    let deletedContestants = 0;
    let deletedCouples = 0;
    let deletedTranscripts = 0;

    for (const dup of duplicates) {
        const episodeId = dup.id;
        console.log(`Processing ${episodeId} (ep ${dup.episodeNumber})...`);

        // --- Contestants linked to this UUID episode ---
        const cSnap = await db.collection('contestants').where('episodeId', '==', episodeId).get();
        console.log(`  contestants: ${cSnap.size}`);
        if (!DRY_RUN) {
            // Delete in batches of 400 to stay under Firestore batch limits
            const chunks = [];
            for (let i = 0; i < cSnap.docs.length; i += 400) {
                chunks.push(cSnap.docs.slice(i, i + 400));
            }
            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        deletedContestants += cSnap.size;

        // --- Couples linked to this UUID episode ---
        const coSnap = await db.collection('couples').where('episodeId', '==', episodeId).get();
        console.log(`  couples: ${coSnap.size}`);
        if (!DRY_RUN) {
            const chunks = [];
            for (let i = 0; i < coSnap.docs.length; i += 400) {
                chunks.push(coSnap.docs.slice(i, i + 400));
            }
            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        deletedCouples += coSnap.size;

        // --- Transcript ---
        const tRef = db.collection('transcripts').doc(episodeId);
        const tSnap = await tRef.get();
        if (tSnap.exists) {
            console.log(`  transcript: found`);
            if (!DRY_RUN) await tRef.delete();
            deletedTranscripts++;
        } else {
            console.log(`  transcript: none`);
        }

        // --- Analysis doc itself ---
        if (!DRY_RUN) {
            await db.collection('analyses').doc(episodeId).delete();
        }
        deletedAnalyses++;
    }

    console.log('\n=== SUMMARY ===');
    console.log(`${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleted'}:`);
    console.log(`  analyses:    ${deletedAnalyses}`);
    console.log(`  contestants: ${deletedContestants}`);
    console.log(`  couples:     ${deletedCouples}`);
    console.log(`  transcripts: ${deletedTranscripts}`);

    if (DRY_RUN) {
        console.log('\nRun with DRY_RUN=false to apply changes.');
    } else {
        console.log(`\nDone. Firestore now has ${allDocs.length - deletedAnalyses} analyses docs.`);
        console.log('BigQuery will reflect the change after the next Firebase extension sync + scheduled query run.');
    }
}

run()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
