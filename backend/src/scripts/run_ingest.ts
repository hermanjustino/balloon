import * as admin from 'firebase-admin';
import { runIngest } from '../ingest';

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: process.env.PROJECT_ID || 'balloon-87473' });
}

runIngest()
    .then(result => {
        console.log('\n=== INGEST COMPLETE ===');
        console.log(`Processed: ${result.processed}`);
        console.log(`Skipped:   ${result.skipped}`);
        console.log(`Failed:    ${result.failed}`);
        if (result.episodes.length > 0) console.log('Episodes:', result.episodes);
        if (result.errors.length > 0) console.log('Errors:', result.errors);
        process.exit(0);
    })
    .catch(err => {
        console.error('Ingest failed:', err.message);
        process.exit(1);
    });
