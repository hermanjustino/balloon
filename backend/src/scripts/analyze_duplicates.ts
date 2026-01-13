import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function analyzeDuplicates() {
    console.log("Fetching data for analysis...");

    // 1. Fetch all existing contestants
    // 2400 records is small enough to hold in memory
    const contestantsSnap = await db.collection('contestants').get();
    const allContestants = contestantsSnap.docs.map(d => ({
        id: d.id, 
        ...d.data()
    })) as any[];

    console.log(`Total documents in 'contestants': ${allContestants.length}`);

    // Create Lookups
    // Map: "EpisodeID:Name" -> Record (The 'Real' record)
    const realRecordsMap = new Map<string, any>();
    // Map: "ID" -> Record (The potential 'Bad' record)
    const recordsById = new Map<string, any>();
    
    // Counter for bad records (sparse, only gender)
    const badRecords = [];

    for (const rec of allContestants) {
        recordsById.set(rec.id, rec);

        if (rec.name && rec.episodeId) {
            // Normalize name key: lowercase, trim
            const key = `${rec.episodeId}:${rec.name.trim().toLowerCase()}`;
            realRecordsMap.set(key, rec);
        }

        // Identify "Bad" records: Have gender, NO name
        if (rec.gender && !rec.name) {
            badRecords.push(rec);
        }
    }

    console.log(`Identified ${badRecords.length} sparse 'bad' records (Gender only, no Name).`);
    console.log(`Identified ${realRecordsMap.size} valid 'real' records (Have Name + EpisodeId).`);

    // 2. Fetch Analyses to link them
    const analysesSnap = await db.collection('analyses').get();
    console.log(`Fetched ${analysesSnap.size} analyses.`);

    let matchedFixable = 0;
    let noMatchFound = 0;
    let alreadyHasGender = 0;

    console.log("\n--- Sample Matches ---");

    for (const analysisDoc of analysesSnap.docs) {
        const analysis = analysisDoc.data();
        const episodeId = analysis.id;
        const contestantsList = analysis.contestants || (analysis.data && analysis.data.contestants) || [];

        if (!Array.isArray(contestantsList)) continue;

        for (const item of contestantsList) {
            if (!item.name) continue;

            // This is the ID that the previous script wrote to
            const badId = item.id; 
            const sourceGender = item.gender;

            if (!sourceGender) continue;

            // Check if a "Bad Record" actually exists with this ID
            const badRecordExists = recordsById.has(badId) && !recordsById.get(badId).name;
            
            // Try to find the "Real Record"
            const key = `${episodeId}:${item.name.trim().toLowerCase()}`;
            const realRecord = realRecordsMap.get(key);

            if (realRecord) {
                if (!realRecord.gender || realRecord.gender === 'Unknown') {
                    // This is a fixable case!
                    matchedFixable++;
                    if (matchedFixable <= 5) {
                        console.log(`[FIXABLE] Name: ${item.name}`);
                        console.log(`   > Merge Gender '${sourceGender}' from BadID: ${badId} (Exists? ${badRecordExists})`);
                        console.log(`   > Into RealID: ${realRecord.id}`);
                    }
                } else {
                    alreadyHasGender++;
                }
            } else {
                noMatchFound++;
                // console.log(`[NO MATCH] Could not find real record for ${item.name} in Ep ${episodeId}`);
            }
        }
    }

    console.log("\n--- Summary ---");
    console.log(`Fixable Pairs Found: ${matchedFixable} (We can merge gender & delete bad record)`);
    console.log(`Real records already having gender: ${alreadyHasGender}`);
    console.log(`Unmatched (Analysis has contestant, but no Real Record found): ${noMatchFound}`);
    console.log(`Total Bad Records currently in DB: ${badRecords.length}`);
}

analyzeDuplicates().catch(console.error);
