/**
 * DIAGNOSTIC: Episode Count Discrepancy
 *
 * Compares Firestore vs BigQuery to surface:
 *   1. All distinct episode_ids in BigQuery contestants_raw_latest
 *   2. Which are multi-part (ep_N_ptM) vs normal (ep_N)
 *   3. Base episode numbers that have BOTH old (ep_N) AND new (ep_N_ptM) records — orphan indicator
 *   4. Firestore analyses count vs BigQuery distinct base episode count
 *   5. Contestant counts: Firestore vs BigQuery total
 *
 * Run from backend/:
 *   npx ts-node src/scripts/diagnose_episode_count.ts
 */

import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'balloon-87473';

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();
const bq = new BigQuery({ projectId: PROJECT_ID });

async function run() {
    console.log('=== EPISODE COUNT DIAGNOSTIC ===\n');

    // ----------------------------------------------------------------
    // 1. Firestore: how many analyses docs exist?
    // ----------------------------------------------------------------
    const analysesSnap = await db.collection('analyses').get();
    const analysisIds = analysesSnap.docs.map(d => d.id).sort();
    console.log(`[Firestore] analyses docs:    ${analysisIds.length}`);

    const partIds    = analysisIds.filter(id => /_pt\d+$/.test(id));
    const normalIds  = analysisIds.filter(id => !/_pt\d+$/.test(id));
    console.log(`  Normal (ep_N):              ${normalIds.length}`);
    console.log(`  Multi-part (ep_N_ptM):      ${partIds.length}`);

    // Unique base episode numbers from Firestore
    const fsBaseEps = new Set(analysisIds.map(id => id.replace(/_pt\d+$/, '')));
    console.log(`  Distinct base episodes:     ${fsBaseEps.size}`);

    // ----------------------------------------------------------------
    // 2. Firestore: contestant count
    // ----------------------------------------------------------------
    const contestantsSnap = await db.collection('contestants').get();
    console.log(`\n[Firestore] contestants docs: ${contestantsSnap.size}`);

    // ----------------------------------------------------------------
    // 3. BigQuery: all distinct episode_ids + contestant counts
    // ----------------------------------------------------------------
    const [bqRows] = await bq.query({
        query: `
            SELECT
                COALESCE(JSON_VALUE(data, '$.episodeId'), JSON_VALUE(data, '$.episode_id')) AS episode_id,
                COUNT(*) AS contestant_count
            FROM \`${PROJECT_ID}.balloon_dataset.contestants_raw_latest\`
            GROUP BY 1
            ORDER BY 1
        `,
    });

    const bqEpisodeIds = bqRows
        .map((r: any) => ({ id: r.episode_id as string, count: Number(r.contestant_count) }))
        .filter(r => r.id);

    const bqNullRows = bqRows.filter((r: any) => !r.episode_id).length;
    const bqTotal = bqEpisodeIds.reduce((s, r) => s + r.count, 0) + bqNullRows;

    console.log(`\n[BigQuery]  contestants_raw_latest total rows: ${bqTotal}`);
    if (bqNullRows > 0) console.log(`  ⚠️  Rows with NULL episode_id: ${bqNullRows}`);

    const bqNormal    = bqEpisodeIds.filter(r => !/_pt\d+$/.test(r.id));
    const bqMultiPart = bqEpisodeIds.filter(r => /_pt\d+$/.test(r.id));
    console.log(`  Distinct episode_ids:        ${bqEpisodeIds.length}`);
    console.log(`    Normal (ep_N):             ${bqNormal.length}`);
    console.log(`    Multi-part (ep_N_ptM):     ${bqMultiPart.length}`);

    const bqBaseEps = new Set(bqEpisodeIds.map(r => r.id.replace(/_pt\d+$/, '')));
    console.log(`    Distinct BASE episodes:    ${bqBaseEps.size}`);

    // ----------------------------------------------------------------
    // 4. Orphan check: base episodes with BOTH old and new style IDs
    //    e.g. ep_90 AND ep_90_pt1 both exist → old record never cleaned up
    // ----------------------------------------------------------------
    const orphanedBases: string[] = [];
    for (const { id } of bqMultiPart) {
        const base = id.replace(/_pt\d+$/, '');
        if (bqNormal.some(r => r.id === base)) {
            if (!orphanedBases.includes(base)) orphanedBases.push(base);
        }
    }

    if (orphanedBases.length > 0) {
        console.log(`\n⚠️  ORPHAN ALERT: ${orphanedBases.length} base episode(s) have BOTH old (ep_N) AND new (ep_N_ptM) contestant rows in BigQuery:`);
        for (const base of orphanedBases.sort()) {
            const oldRows = bqEpisodeIds.find(r => r.id === base)?.count ?? 0;
            const newRows = bqEpisodeIds.filter(r => r.id.startsWith(base + '_pt')).map(r => r.count);
            console.log(`  ${base}: ${oldRows} old-style rows | ${newRows.join(' + ')} new-style rows`);
        }
    } else {
        console.log('\n✅ No orphaned episode_ids detected (no base has both old and new style).');
    }

    // ----------------------------------------------------------------
    // 5. Episodes in BigQuery but NOT in Firestore analyses (stale BQ data)
    // ----------------------------------------------------------------
    const inBqNotFs = [...bqBaseEps].filter(base => !fsBaseEps.has(base)).sort();
    if (inBqNotFs.length > 0) {
        console.log(`\n⚠️  ${inBqNotFs.length} base episode(s) in BigQuery but NOT in Firestore analyses:`);
        inBqNotFs.forEach(id => console.log(`  ${id}`));
    } else {
        console.log('\n✅ All BigQuery base episodes exist in Firestore analyses.');
    }

    // ----------------------------------------------------------------
    // 6. Episodes in Firestore but NOT in BigQuery (sync lag or gap)
    // ----------------------------------------------------------------
    const inFsNotBq = [...fsBaseEps].filter(base => !bqBaseEps.has(base)).sort();
    if (inFsNotBq.length > 0) {
        console.log(`\n⚠️  ${inFsNotBq.length} base episode(s) in Firestore but NOT yet in BigQuery (sync lag?):`);
        inFsNotBq.forEach(id => console.log(`  ${id}`));
    } else {
        console.log('\n✅ All Firestore episodes are reflected in BigQuery.');
    }

    // ----------------------------------------------------------------
    // 7. Summary
    // ----------------------------------------------------------------
    console.log('\n=== SUMMARY ===');
    console.log(`Firestore analyses docs:          ${analysisIds.length}`);
    console.log(`Firestore distinct base episodes: ${fsBaseEps.size}`);
    console.log(`BigQuery distinct episode_ids:    ${bqEpisodeIds.length}  ← what dashboard shows as "114"`);
    console.log(`BigQuery distinct BASE episodes:  ${bqBaseEps.size}  ← what dashboard SHOULD show`);
    console.log(`Orphaned old-style episode IDs:   ${orphanedBases.length}`);
    console.log(`Firestore contestants:            ${contestantsSnap.size}`);
    console.log(`BigQuery contestants (latest):    ${bqTotal}`);
    console.log(`BQ vs FS contestant delta:        ${bqTotal - contestantsSnap.size}`);
}

run()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
