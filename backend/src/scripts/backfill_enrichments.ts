import * as admin from 'firebase-admin';
import { runIngest, analyzeTranscript } from '../ingest';

/**
 * BACKFILL SCRIPT: ENRICHMENTS
 * Iterate through all existing analyses and re-process them with the new
 * enriched schema (popReason, industry, dramaScore, etc.) if they are missing it.
 */

async function backfill() {
    console.log('--- STARTING BACKFILL: ENRICHMENTS ---');
    
    // Initialize admin if not already done
    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: 'balloon-87473'
        });
    }

    const db = admin.firestore();
    const analysesSnapshot = await db.collection('analyses').get();
    
    console.log(`Found ${analysesSnapshot.size} total analyses to check.`);
    
    let updatedCount = 0;
    
    for (const doc of analysesSnapshot.docs) {
        const data = doc.data();
        
        // Check if already enriched (using dramaScore as a proxy)
        if (data.dramaScore !== undefined) {
            console.log(`Skipping ${doc.id}: Already enriched.`);
            continue;
        }

        console.log(`Enriching ${doc.id} (${data.episodeTitle})...`);

        try {
            // 1. Get the transcript
            const transcriptDoc = await db.collection('transcripts').doc(doc.id).get();
            if (!transcriptDoc.exists) {
                console.warn(`No transcript found for ${doc.id}. Skipping.`);
                continue;
            }
            const transcript = transcriptDoc.data()?.content;

            // 2. Re-run analysis with the new schema (now updated in ingest.ts)
            // Note: analyzeTranscript uses the GEMINI_API_KEY from env
            const enrichedResult = await analyzeTranscript(
                transcript, 
                data.episodeNumber || '', 
                data.videoUrl || '', 
                doc.id
            );

            // 3. Save the updated data (saveToFirestore handles analyses, contestants, couples, etc.)
            // We need to import or replicate saveToFirestore logic if it's not exported.
            // Since it's internal to ingest.ts, I'll use it if I can export it or just do a basic update.
            
            // To be safe and reuse the battle-tested logic, we should ideally export saveToFirestore.
            // For this script, I'll update the main analysis and contestants manually.
            
            await db.collection('analyses').doc(doc.id).set(enrichedResult, { merge: true });
            
            // Update individual contestants with their new fields (matching by name)
            const contestantsSnapshot = await db.collection('contestants').where('episodeId', '==', doc.id).get();
            for (const cDoc of contestantsSnapshot.docs) {
                const cData = cDoc.data();
                const updatedC = enrichedResult.contestants.find((c: any) => c.name === cData.name);
                if (updatedC) {
                    await cDoc.ref.update({
                        industry: updatedC.industry || null,
                        popReason: updatedC.popReason || null,
                        popCategory: updatedC.popCategory || null
                    });
                }
            }

            console.log(`✅ ${doc.id} enriched successfully.`);
            updatedCount++;

            // Rate limiting to avoid hitting Gemini quotas too fast
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (err: any) {
            console.error(`❌ Failed to enrich ${doc.id}:`, err.message);
        }
    }

    console.log(`--- BACKFILL COMPLETE: Updated ${updatedCount} episodes ---`);
}

backfill().catch(console.error);
