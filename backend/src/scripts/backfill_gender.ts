import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function backfillGender() {
    console.log("Starting gender backfill...");

    // 1. Get all analyses to extract gender data
    console.log("Fetching analyses...");
    const analysesSnapshot = await db.collection('analyses').get();
    console.log(`Found ${analysesSnapshot.size} analyses.`);

    let updatedCount = 0;
    let errorCount = 0;
    let batchCount = 0;
    
    const batchSize = 400; // limit is 500, keeping it safe
    let batch = db.batch();
    let batchOpCount = 0;

    for (const analysisDoc of analysesSnapshot.docs) {
        const analysis = analysisDoc.data();
        // The structure inside analysis doc is: { id: ..., contestants: [...] }
        // based on the query results I saw earlier (nested contestants array).
        // Let's check if 'data' wrapper exists or if it's flat.
        // The query `SELECT ... FROM ... analyses_raw_latest` showed `data.contestants`.
        // Firestore docs are usually flat if added via the app.
        // Let's handle both just in case, but usually it's analysis.contestants.
        
        const contestants = analysis.contestants || (analysis.data && analysis.data.contestants) || [];

        if (!Array.isArray(contestants)) {
            // console.warn(`Analysis ${analysisDoc.id} has no contestants array.`);
            continue;
        }

        for (const contestant of contestants) {
            if (contestant.id && contestant.gender) {
                const contestantRef = db.collection('contestants').doc(contestant.id);
                
                batch.set(contestantRef, { 
                    gender: contestant.gender 
                }, { merge: true });
                
                batchOpCount++;
                updatedCount++;

                if (batchOpCount >= batchSize) {
                    await batch.commit();
                    batchCount++;
                    console.log(`Committed batch ${batchCount} (${batchOpCount} updates)`);
                    batch = db.batch();
                    batchOpCount = 0;
                }
            }
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
        console.log(`Committed final batch (${batchOpCount} updates)`);
    }

    console.log("Backfill complete.");
    console.log(`Total updates queued: ${updatedCount}`);
}

backfillGender().catch(console.error);
