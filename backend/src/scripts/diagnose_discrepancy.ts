import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = 'balloon-87473';

initializeApp({ projectId });
const db = getFirestore();
const bigquery = new BigQuery({ projectId });

async function diagnoseDiscrepancy() {
    console.log('🔍 Starting Data Discrepancy Diagnosis...\n');

    // 1. Count Firestore Contestants
    const firestoreSnapshot = await db.collection('contestants').get();
    const firestoreCount = firestoreSnapshot.size;
    console.log(`🔥 Firestore Contestants: ${firestoreCount}`);

    // 2. Count BigQuery Contestants (Raw Latest)
    const [bqRows] = await bigquery.query(`
        SELECT count(*) as count 
        FROM \`${projectId}.balloon_dataset.contestants_raw_latest\`
    `);
    const bqCount = bqRows[0].count;
    console.log(`📊 BigQuery Contestants: ${bqCount}`);

    console.log(`\n⚖️  Difference: ${firestoreCount - bqCount}`);

    // 3. Search for 'Burton' in Firestore
    const burtonQuery = await db.collection('contestants')
        .where('name', '==', 'Burton')
        .get();

    console.log(`\n🔎 'Burton' in Firestore: ${burtonQuery.size}`);
    burtonQuery.forEach(doc => {
        const data = doc.data();
        console.log(`   - ID: ${doc.id}, Ep: ${data.episodeNumber} (${data.episodeTitle}), Outcome: ${data.outcome}`);
    });

    // 4. Check for orphaned contestants in BigQuery (that don't exist in Firestore)
    // This might happen if BigQuery sync is lagging or if there were old records not cleaned up in the raw table
    console.log('\n🧠 Checking for potential sync delays...');
}

diagnoseDiscrepancy()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
