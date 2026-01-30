/**
 * Check Data Integrity
 * 
 * Verifies that all analyses have associated contestants and couples
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with explicit project ID
initializeApp({
    projectId: 'balloon-87473'
});

const db = getFirestore();

async function checkIntegrity() {
    console.log('🔍 Checking data integrity...\n');

    // 1. Get all analyses
    const analysesSnapshot = await db.collection('analyses').get();
    console.log(`📊 Total analyses: ${analysesSnapshot.size}`);

    // 2. Get all contestants
    const contestantsSnapshot = await db.collection('contestants').get();
    console.log(`👥 Total contestants: ${contestantsSnapshot.size}`);

    // 3. Get all couples
    const couplesSnapshot = await db.collection('couples').get();
    console.log(`💑 Total couples: ${couplesSnapshot.size}\n`);

    // 4. Check each analysis for associated data
    const orphanedAnalyses: string[] = [];
    const withoutContestants: string[] = [];
    const withoutCouples: string[] = [];

    for (const doc of analysesSnapshot.docs) {
        const id = doc.id;
        const data = doc.data();
        const epNum = data.episodeNumber || 'N/A';
        const title = data.episodeTitle || 'Untitled';

        // Check contestants
        const contestantsQuery = await db.collection('contestants')
            .where('episodeId', '==', id)
            .get();

        // Check couples
        const couplesQuery = await db.collection('couples')
            .where('episodeId', '==', id)
            .get();

        if (contestantsQuery.empty) {
            withoutContestants.push(`Ep ${epNum} (${id}): "${title}" - NO CONTESTANTS`);
        }

        if (couplesQuery.empty) {
            withoutCouples.push(`Ep ${epNum} (${id}): "${title}" - NO COUPLES`);
        }

        if (contestantsQuery.empty && couplesQuery.empty) {
            orphanedAnalyses.push(`Ep ${epNum} (${id}): "${title}"`);
        }
    }

    // 5. Report findings
    console.log('═══════════════════════════════════════\n');

    if (orphanedAnalyses.length > 0) {
        console.log(`❌ CRITICAL: ${orphanedAnalyses.length} analyses with NO contestants OR couples:`);
        orphanedAnalyses.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    if (withoutContestants.length > 0) {
        console.log(`⚠️  ${withoutContestants.length} analyses missing contestants:`);
        withoutContestants.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    if (withoutCouples.length > 0) {
        console.log(`⚠️  ${withoutCouples.length} analyses missing couples:`);
        withoutCouples.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    if (orphanedAnalyses.length === 0 && withoutContestants.length === 0 && withoutCouples.length === 0) {
        console.log('✅ All analyses have associated contestants and couples!\n');
    }

    // 6. Check for orphaned contestants/couples
    console.log('═══════════════════════════════════════\n');
    console.log('🔍 Checking for orphaned contestants/couples...\n');

    const analysisIds = new Set(analysesSnapshot.docs.map(d => d.id));
    const orphanedContestants: string[] = [];
    const orphanedCouples: string[] = [];

    for (const doc of contestantsSnapshot.docs) {
        const episodeId = doc.data().episodeId;
        if (!analysisIds.has(episodeId)) {
            orphanedContestants.push(episodeId);
        }
    }

    for (const doc of couplesSnapshot.docs) {
        const episodeId = doc.data().episodeId;
        if (!analysisIds.has(episodeId)) {
            orphanedCouples.push(episodeId);
        }
    }

    if (orphanedContestants.length > 0) {
        const uniqueEpisodes = new Set(orphanedContestants);
        console.log(`⚠️  ${orphanedContestants.length} orphaned contestants from ${uniqueEpisodes.size} deleted episodes`);
    }

    if (orphanedCouples.length > 0) {
        const uniqueEpisodes = new Set(orphanedCouples);
        console.log(`⚠️  ${orphanedCouples.length} orphaned couples from ${uniqueEpisodes.size} deleted episodes`);
    }

    if (orphanedContestants.length === 0 && orphanedCouples.length === 0) {
        console.log('✅ No orphaned contestants or couples found!');
    }

    console.log('\n🎉 Integrity check complete!');
}

// Run the script
checkIntegrity()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });
