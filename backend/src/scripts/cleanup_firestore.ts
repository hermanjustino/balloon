import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

function normalize(str: string): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function cleanupFirestore() {
    console.log("Starting cleanup process...");

    // 1. Fetch all contestants
    console.log("Fetching all contestants...");
    const contestantsSnap = await db.collection('contestants').get();
    const allContestants = contestantsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
    })) as any[];

    console.log(`Total documents in 'contestants': ${allContestants.length}`);

    // 2. Partition records
    const validRecords = [];
    const ghostRecords = [];
    const validRecordsMap = new Map<string, any>(); // Key: episodeId + normalized(name)

    for (const rec of allContestants) {
        if (rec.name && rec.episodeId) {
            validRecords.push(rec);
            const key = `${rec.episodeId}:${normalize(rec.name)}`;
            validRecordsMap.set(key, rec);
        } else if (rec.gender && !rec.name) {
            ghostRecords.push(rec);
        } else {
            // Weird record?
            // console.log("Skipping unclear record:", rec.id);
        }
    }

    console.log(`Found ${validRecords.length} valid records (Name + Episode).`);
    console.log(`Found ${ghostRecords.length} ghost records (Gender only).`);

    if (ghostRecords.length === 0) {
        console.log("No ghost records found. Cleanup might already be complete.");
        return;
    }

    // 3. Fetch Analyses to get metadata for ghost records
    console.log("Fetching analyses to identify ghost records...");
    const analysesSnap = await db.collection('analyses').get();
    
    // Map: GhostID -> { name, episodeId, gender }
    const ghostMetadata = new Map<string, { name: string, episodeId: string, gender: string }>();

    for (const analysisDoc of analysesSnap.docs) {
        const analysis = analysisDoc.data();
        const episodeId = analysis.id;
        const contestantsList = analysis.contestants || (analysis.data && analysis.data.contestants) || [];

        if (!Array.isArray(contestantsList)) continue;

        for (const item of contestantsList) {
            if (item.id && item.name) {
                // If this ID corresponds to a ghost record, save the metadata
                // We don't check if it IS a ghost record here for speed, just store potentially useful info
                ghostMetadata.set(item.id, {
                    name: item.name,
                    episodeId: episodeId,
                    gender: item.gender
                });
            }
        }
    }

    console.log(`Loaded metadata for potential matches.`);

    // 4. Process Ghost Records
    let batch = db.batch();
    let batchOpCount = 0;
    let deletedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const BATCH_LIMIT = 400;

    for (const ghost of ghostRecords) {
        const meta = ghostMetadata.get(ghost.id);

        if (!meta) {
            console.warn(`[ORPHAN] Ghost record ${ghost.id} (Gender: ${ghost.gender}) not found in Analyses source.`);
            continue;
        }

        // Try to find the target valid record
        const key = `${meta.episodeId}:${normalize(meta.name)}`;
        const targetRecord = validRecordsMap.get(key);

        if (targetRecord) {
            // Match found!
            
            // 1. Update Target if needed
            let needsUpdate = false;
            if (!targetRecord.gender || targetRecord.gender === 'Unknown') {
                batch.set(db.collection('contestants').doc(targetRecord.id), { gender: ghost.gender }, { merge: true });
                needsUpdate = true;
                updatedCount++;
            } else if (targetRecord.gender !== ghost.gender) {
                console.warn(`[CONFLICT] Target ${targetRecord.name} has '${targetRecord.gender}', Ghost has '${ghost.gender}'. Keeping Target.`);
            } else {
                // Already has correct gender
            }

            // 2. Delete Ghost
            batch.delete(db.collection('contestants').doc(ghost.id));
            deletedCount++;
            batchOpCount += (needsUpdate ? 2 : 1);

            if (batchOpCount >= BATCH_LIMIT) {
                await batch.commit();
                console.log(`Committed batch... (Deleted: ${deletedCount}, Updated: ${updatedCount})`);
                batch = db.batch();
                batchOpCount = 0;
            }

        } else {
            console.warn(`[NO TARGET] Ghost ${ghost.id} is '${meta.name}' (Ep ${meta.episodeId}), but no valid record found with that key.`);
            skippedCount++;
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
        console.log(`Committed final batch.`);
    }

    console.log("\n--- Cleanup Complete ---");
    console.log(`Ghost Records Deleted: ${deletedCount}`);
    console.log(`Valid Records Updated: ${updatedCount}`);
    console.log(`Ghost Records Skipped (No Target): ${skippedCount}`);
    console.log(`Ghost Records Orphaned (No Metadata): ${ghostRecords.length - (deletedCount + skippedCount)}`);
}

cleanupFirestore().catch(console.error);
