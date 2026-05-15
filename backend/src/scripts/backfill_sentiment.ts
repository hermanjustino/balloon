import * as admin from 'firebase-admin';
import { fetchComments, analyzeCommentSentiment, saveCommentSentiment } from '../ingest';

/**
 * BACKFILL SCRIPT: COMMENT SENTIMENT
 * Iterates through all processed_episodes, fetches YouTube comments for each,
 * runs Gemini Flash sentiment analysis, and saves to episode_sentiment collection.
 * Skips episodes that already have a sentiment document.
 *
 * Run from backend/:
 *   npx ts-node src/scripts/backfill_sentiment.ts
 *
 * Quota: ~1 YouTube API unit per episode (commentThreads.list) + Gemini Flash call.
 * Processes one episode at a time with a delay to stay within rate limits.
 */

const DELAY_MS = 2000; // 2 seconds between episodes to stay well under quota

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'balloon-87473' });
    }
    const db = admin.firestore();

    const [processedSnap, sentimentSnap] = await Promise.all([
        db.collection('processed_episodes').get(),
        db.collection('episode_sentiment').get(),
    ]);

    const alreadyDone = new Set(sentimentSnap.docs.map(d => d.id));
    const episodes = processedSnap.docs
        .map(d => d.data() as { videoId: string; episodeId: string; episodeNumber: string; title: string })
        .filter(ep => ep.episodeId && ep.videoId)
        .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));

    console.log(`Found ${episodes.length} processed episodes, ${alreadyDone.size} already have sentiment.`);
    const pending = episodes.filter(ep => !alreadyDone.has(ep.episodeId));
    console.log(`${pending.length} to process.\n`);

    let done = 0, skipped = 0, failed = 0;

    for (const ep of pending) {
        console.log(`[${done + skipped + failed + 1}/${pending.length}] ${ep.episodeId}: "${ep.title}"`);
        try {
            const comments = await fetchComments(ep.videoId, 100);
            if (comments.length === 0) {
                console.log(`  -> No comments (disabled or empty), skipping.`);
                skipped++;
            } else {
                const sentiment = await analyzeCommentSentiment(comments, ep.episodeNumber);
                await saveCommentSentiment(ep.episodeId, ep.episodeNumber, ep.videoId, comments, sentiment);
                console.log(`  -> ${sentiment.overallSentiment} (score: ${sentiment.sentimentScore}) | themes: ${sentiment.topThemes.join(', ')}`);
                done++;
            }
        } catch (err: any) {
            console.error(`  -> FAILED: ${err.message}`);
            failed++;
        }
        await sleep(DELAY_MS);
    }

    console.log(`\nDone. Saved: ${done}, skipped (no comments): ${skipped}, failed: ${failed}`);
}

main().catch(console.error);
