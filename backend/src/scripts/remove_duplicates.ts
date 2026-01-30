/**
 * Remove Duplicate Episode Analyses
 * 
 * This script finds and removes duplicate episode analyses from Firestore,
 * keeping only the most recent one for each episode number.
 * It also cleans up associated contestants and couples records.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with explicit project ID
initializeApp({
    projectId: 'balloon-87473'
});


const db = getFirestore();

interface Analysis {
    id: string;
    episodeNumber?: string;
    episodeTitle: string;
    dateAnalyzed?: string;
    createdAt?: any;
}

async function removeDuplicates() {
    console.log('🔍 Finding duplicate episodes...\n');

    // 1. Fetch all analyses
    const analysesSnapshot = await db.collection('analyses').get();
    const analyses: Analysis[] = analysesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Analysis));

    console.log(`📊 Total analyses found: ${analyses.length}`);

    // 2. Group by episode number
    const byEpisode = new Map<string, Analysis[]>();

    for (const analysis of analyses) {
        if (!analysis.episodeNumber) {
            console.log(`⚠️  Skipping analysis without episode number: ${analysis.id} - "${analysis.episodeTitle}"`);
            continue;
        }

        const epNum = analysis.episodeNumber;
        if (!byEpisode.has(epNum)) {
            byEpisode.set(epNum, []);
        }
        byEpisode.get(epNum)!.push(analysis);
    }

    // 3. Find duplicates
    const duplicates: string[] = [];
    let totalDuplicates = 0;

    for (const [epNum, episodes] of byEpisode.entries()) {
        if (episodes.length > 1) {
            console.log(`\n🔴 Episode ${epNum} has ${episodes.length} duplicates:`);

            // Sort by dateAnalyzed or createdAt (most recent first)
            episodes.sort((a, b) => {
                const dateA = a.dateAnalyzed || a.createdAt?.toDate?.()?.toISOString() || '';
                const dateB = b.dateAnalyzed || b.createdAt?.toDate?.()?.toISOString() || '';
                return dateB.localeCompare(dateA);
            });

            // Keep the first (most recent), delete the rest
            const [keep, ...remove] = episodes;
            console.log(`   ✅ KEEP: ${keep.id} - "${keep.episodeTitle}" (${keep.dateAnalyzed || 'no date'})`);

            for (const dup of remove) {
                console.log(`   🗑️  DELETE: ${dup.id} - "${dup.episodeTitle}" (${dup.dateAnalyzed || 'no date'})`);
                duplicates.push(dup.id);
            }

            totalDuplicates += remove.length;
        }
    }

    if (duplicates.length === 0) {
        console.log('\n✅ No duplicates found!');
        return;
    }

    console.log(`\n📋 Summary: Found ${totalDuplicates} duplicate analyses to remove`);
    console.log(`⏳ Waiting 5 seconds before deletion... (Ctrl+C to cancel)`);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Delete duplicates and their associated data
    console.log('\n🗑️  Deleting duplicates...\n');

    for (const id of duplicates) {
        try {
            // Delete the analysis
            await db.collection('analyses').doc(id).delete();
            console.log(`   ✅ Deleted analysis: ${id}`);

            // Delete associated contestants
            const contestantsSnapshot = await db.collection('contestants')
                .where('episodeId', '==', id)
                .get();

            if (!contestantsSnapshot.empty) {
                const contestantDeletes = contestantsSnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(contestantDeletes);
                console.log(`      🧹 Deleted ${contestantsSnapshot.size} contestants`);
            }

            // Delete associated couples
            const couplesSnapshot = await db.collection('couples')
                .where('episodeId', '==', id)
                .get();

            if (!couplesSnapshot.empty) {
                const coupleDeletes = couplesSnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(coupleDeletes);
                console.log(`      🧹 Deleted ${couplesSnapshot.size} couples`);
            }

        } catch (error) {
            console.error(`   ❌ Error deleting ${id}:`, error);
        }
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalDuplicates} duplicate episodes.`);
    console.log(`📊 Final episode count should be: ${byEpisode.size}`);
}

// Run the script
removeDuplicates()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });
