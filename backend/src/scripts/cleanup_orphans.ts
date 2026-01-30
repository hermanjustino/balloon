/**
 * Clean up orphaned contestants and couples
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
    projectId: 'balloon-87473'
});

const db = getFirestore();

async function cleanupOrphans() {
    console.log('🧹 Cleaning up orphaned records...\n');

    // Get all valid analysis IDs
    const analysesSnapshot = await db.collection('analyses').get();
    const validIds = new Set(analysesSnapshot.docs.map(d => d.id));

    console.log(`📊 Valid episode IDs: ${validIds.size}\n`);

    // Find orphaned contestants
    const contestantsSnapshot = await db.collection('contestants').get();
    const orphanedContestants: string[] = [];

    for (const doc of contestantsSnapshot.docs) {
        const episodeId = doc.data().episodeId;
        if (!validIds.has(episodeId)) {
            orphanedContestants.push(doc.id);
        }
    }

    // Find orphaned couples
    const couplesSnapshot = await db.collection('couples').get();
    const orphanedCouples: string[] = [];

    for (const doc of couplesSnapshot.docs) {
        const episodeId = doc.data().episodeId;
        if (!validIds.has(episodeId)) {
            orphanedCouples.push(doc.id);
        }
    }

    console.log(`🗑️  Found ${orphanedContestants.length} orphaned contestants`);
    console.log(`🗑️  Found ${orphanedCouples.length} orphaned couples\n`);

    if (orphanedContestants.length === 0 && orphanedCouples.length === 0) {
        console.log('✅ No orphaned records to clean!');
        return;
    }

    console.log('⏳ Deleting in 3 seconds... (Ctrl+C to cancel)\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete orphaned contestants
    for (const id of orphanedContestants) {
        await db.collection('contestants').doc(id).delete();
    }
    console.log(`✅ Deleted ${orphanedContestants.length} orphaned contestants`);

    // Delete orphaned couples
    for (const id of orphanedCouples) {
        await db.collection('couples').doc(id).delete();
    }
    console.log(`✅ Deleted ${orphanedCouples.length} orphaned couples`);

    console.log('\n🎉 Cleanup complete!');
}

cleanupOrphans()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });
