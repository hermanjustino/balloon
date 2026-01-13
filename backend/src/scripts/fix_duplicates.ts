import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function fixDuplicates() {
    console.log("Starting duplicate fix process...");

    // 1. Fetch all existing contestants
    const contestantsSnap = await db.collection('contestants').get();
    const allContestants = contestantsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
    })) as any[];

    console.log(`Loaded ${allContestants.length} contestants.`);

    // Create Lookups
    const realRecordsMap = new Map<string, any>();
    const recordsById = new Map<string, any>();

    for (const rec of allContestants) {
        recordsById.set(rec.id, rec);
        if (rec.name && rec.episodeId) {
            const key = `${rec.episodeId}:${rec.name.trim().toLowerCase()}`;
            realRecordsMap.set(key, rec);
        }
    }

    // 2. Fetch Analyses to link them
    const analysesSnap = await db.collection('analyses').get();
    console.log(`Fetched ${analysesSnap.size} analyses.`);

    let batch = db.batch();
    let batchOpCount = 0;
    let totalFixed = 0;
    let totalDeleted = 0;
    let batchesCommitted = 0;
    const BATCH_LIMIT = 400; // 2 operations per pair (update + delete)

    for (const analysisDoc of analysesSnap.docs) {
        const analysis = analysisDoc.data();
        const episodeId = analysis.id;
        const contestantsList = analysis.contestants || (analysis.data && analysis.data.contestants) || [];

        if (!Array.isArray(contestantsList)) continue;

        for (const item of contestantsList) {
            if (!item.name || !item.gender) continue;

            const badId = item.id;
            const sourceGender = item.gender;

            // Check if Bad Record exists and is actually "bad" (sparse)
            const badRecord = recordsById.get(badId);
            const isBadRecord = badRecord && !badRecord.name;

            // Find Real Record
            const key = `${episodeId}:${item.name.trim().toLowerCase()}`;
            const realRecord = realRecordsMap.get(key);

            // Only fix if we have a Bad Record (gender source) and a Real Record (target)
            if (isBadRecord && realRecord && (!realRecord.gender || realRecord.gender === 'Unknown')) {
                // Update Real Record with gender
                const realRef = db.collection('contestants').doc(realRecord.id);
                batch.set(realRef, { gender: sourceGender }, { merge: true });

                // Delete Bad Record
                const badRef = db.collection('contestants').doc(badId);
                batch.delete(badRef);

                batchOpCount += 2;
                totalFixed++;
                totalDeleted++;

                if (batchOpCount >= BATCH_LIMIT) {
                    await batch.commit();
                    batchesCommitted++;
                    console.log(`Committed batch ${batchesCommitted} (Fixed ~${batchOpCount/2} pairs)`);
                    batch = db.batch();
                    batchOpCount = 0;
                }
            }
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
        console.log(`Committed final batch.`);
    }

    console.log("\n--- Fix Complete ---");
    console.log(`Total Records Updated (Gender added): ${totalFixed}`);
    console.log(`Total Bad Records Deleted: ${totalDeleted}`);
}

fixDuplicates().catch(console.error);
