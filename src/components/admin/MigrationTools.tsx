import React, { useState } from 'react';
import { StorageService } from '../../services/storage';
import { AIService } from '../../services/ai';
import { AnalysisResult } from '../../types';

export const MigrationTools = () => {
    const [isMigrating, setIsMigrating] = useState(false);
    const [progress, setProgress] = useState('');

    const handleMigration = async () => {
        if (!confirm("This will scan all records and use AI to parse legacy location strings into City/State objects. Continue?")) return;

        setIsMigrating(true);
        setProgress('Fetching all records...');

        try {
            // 1. Fetch All
            const allHistory = await StorageService.getHistory();

            // 2. Identify candidates (those with string locations)
            const candidates = allHistory.filter(h =>
                h.contestants?.some(c => typeof c.location === 'string')
            );

            if (candidates.length === 0) {
                alert("No legacy records found needing migration!");
                setIsMigrating(false);
                setProgress('');
                return;
            }

            setProgress(`Found ${candidates.length} episodes to migrate. Processing...`);

            // 3. Process each episode
            const updates: AnalysisResult[] = [];

            for (let i = 0; i < candidates.length; i++) {
                const ep = candidates[i];
                setProgress(`Migrating Episode ${ep.episodeNumber || ep.id} (${i + 1}/${candidates.length})...`);

                // Refine locations
                if (ep.contestants) {
                    const refinedContestants = await AIService.refineLocations(ep.contestants as any[]);
                    updates.push({
                        ...ep,
                        contestants: refinedContestants
                    });
                }
            }

            // 4. Batch Save
            setProgress(`Saving ${updates.length} updated records...`);
            await StorageService.batchUpdateAnalyses(updates);

            alert(`Migration Complete! Updated ${updates.length} episodes.`);
            window.location.reload(); // Refresh to see changes

        } catch (e) {
            console.error("Migration Error:", e);
            alert("Migration failed. Check console.");
        } finally {
            setIsMigrating(false);
            setProgress('');
        }
    };

    return (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px dashed var(--primary-color)', borderRadius: '8px', background: 'rgba(193, 49, 17, 0.05)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--primary-color)' }}>🔧 Admin Tools</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={handleMigration}
                    disabled={isMigrating}
                    className="btn-secondary"
                    style={{ fontSize: '0.9rem' }}
                >
                    {isMigrating ? 'Migrating...' : 'Migrate Legacy Locations'}
                </button>
                {progress && <span style={{ fontSize: '0.9rem', color: 'var(--text-muted-color)' }}>{progress}</span>}
            </div>
        </div>
    );
};
