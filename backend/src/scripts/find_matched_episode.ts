import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'balloon-87473' });
const db = admin.firestore();

async function main() {
    // Get couples with both contestant IDs
    const couplesSnap = await db.collection('couples')
        .where('contestant1Id', '!=', null)
        .limit(100)
        .get();

    // Group by episodeNumber, find lowest
    const episodes = new Map<string, any[]>();
    for (const doc of couplesSnap.docs) {
        const d = doc.data();
        const ep = d.episodeNumber || d.episodeId || 'unknown';
        if (!episodes.has(ep)) episodes.set(ep, []);
        episodes.get(ep)!.push({ ...d, id: doc.id });
    }

    // Sort numerically
    const sorted = [...episodes.entries()].sort((a, b) => {
        const na = parseInt(a[0].replace(/\D/g, '')) || 9999;
        const nb = parseInt(b[0].replace(/\D/g, '')) || 9999;
        return na - nb;
    });

    const [firstEp, couples] = sorted[0];
    console.log('Earliest episode with matches:', firstEp);
    console.log('Couples:', JSON.stringify(couples, null, 2));

    // Get contestant details
    for (const couple of couples) {
        const [c1, c2] = await Promise.all([
            db.collection('contestants').doc(couple.contestant1Id).get(),
            db.collection('contestants').doc(couple.contestant2Id).get(),
        ]);
        console.log('\n--- Couple ---');
        console.log('Person 1:', c1.data()?.name, '| age:', c1.data()?.age, '| job:', c1.data()?.job);
        console.log('Person 2:', c2.data()?.name, '| age:', c2.data()?.age, '| job:', c2.data()?.job);
    }

    // Get video URL from analysis
    const analysisDoc = await db.collection('analyses').doc(`ep_${firstEp}`).get();
    if (!analysisDoc.exists) {
        // try without prefix
        const snap2 = await db.collection('analyses').where('episodeNumber', '==', firstEp).limit(1).get();
        if (!snap2.empty) console.log('\nVideo URL:', snap2.docs[0].data().videoUrl);
    } else {
        console.log('\nVideo URL:', analysisDoc.data()?.videoUrl);
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
