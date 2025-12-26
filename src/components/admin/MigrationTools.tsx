import React, { useState } from 'react';
import { StorageService } from '../../services/storage';
import { AIService } from '../../services/ai';
import { AnalysisResult } from '../../types';

type MigrationTask = 'locations' | 'reanalyze' | 'populate';

export const MigrationTools = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [currentTask, setCurrentTask] = useState<MigrationTask | null>(null);

    // --- Existing: Migrate Legacy Locations ---
    const handleLocationMigration = async () => {
        if (!confirm("This will scan all records and use AI to parse legacy location strings. Continue?")) return;

        setCurrentTask('locations');
        setIsRunning(true);
        setProgress('Fetching all records...');

        try {
            const allHistory = await StorageService.getHistory();
            const candidates = allHistory.filter(h =>
                h.contestants?.some(c =>
                    typeof c.location === 'string' ||
                    (typeof c.location === 'object' && (!c.location.state || c.location.state === 'Unknown'))
                )
            );

            if (candidates.length === 0) {
                alert("No legacy records found needing location migration!");
                return;
            }

            setProgress(`Found ${candidates.length} episodes. Processing...`);
            const updates: AnalysisResult[] = [];

            for (let i = 0; i < candidates.length; i++) {
                const ep = candidates[i];
                setProgress(`Migrating ${i + 1}/${candidates.length}...`);
                if (ep.contestants) {
                    const refined = await AIService.refineLocations(ep.contestants as any[]);
                    updates.push({ ...ep, contestants: refined });
                }
            }

            setProgress(`Saving ${updates.length} updates...`);
            await StorageService.batchUpdateAnalyses(updates);
            alert(`Location Migration Complete! Updated ${updates.length} episodes.`);
            window.location.reload();

        } catch (e) {
            console.error("Location Migration Error:", e);
            alert("Migration failed. Check console.");
        } finally {
            setIsRunning(false);
            setProgress('');
            setCurrentTask(null);
        }
    };

    // --- NEW: Re-Analyze All Episodes (Uses Stored Transcripts) ---
    const handleReAnalyzeAll = async () => {
        if (!confirm("This will re-run AI analysis on ALL episodes using their stored transcripts. This can take several minutes and will overwrite existing contestant data. Continue?")) return;

        setCurrentTask('reanalyze');
        setIsRunning(true);
        setProgress('Fetching all episodes...');

        try {
            const allHistory = await StorageService.getHistory();
            // Filter to those that have transcripts (either legacy or new)
            const withTranscripts = allHistory.filter(ep => ep.hasTranscript || ep.transcript || ep.transcriptUrl);

            if (withTranscripts.length === 0) {
                alert("No episodes with saved transcripts found!");
                return;
            }

            setProgress(`Found ${withTranscripts.length} episodes with transcripts. Re-analyzing...`);
            const updates: AnalysisResult[] = [];
            const failed: string[] = [];

            for (let i = 0; i < withTranscripts.length; i++) {
                const ep = withTranscripts[i];
                const label = ep.episodeNumber ? `Ep ${ep.episodeNumber}` : ep.episodeTitle;
                setProgress(`Re-analyzing ${label} (${i + 1}/${withTranscripts.length})...`);

                try {
                    // Load transcript
                    const transcript = await StorageService.loadTranscript(ep);
                    if (!transcript) {
                        failed.push(`${label}: No transcript found`);
                        continue;
                    }

                    // Re-analyze (but using existing ID to overwrite)
                    const result = await AIService.analyzeTranscript(transcript, ep.episodeNumber, ep.videoUrl);

                    // Preserve original ID and merge new data
                    updates.push({
                        ...result,
                        id: ep.id, // Keep original ID for overwrite
                        dateAnalyzed: ep.dateAnalyzed || result.dateAnalyzed || new Date().toISOString().split('T')[0]
                    });

                } catch (epError) {
                    console.error(`Failed to re-analyze ${label}:`, epError);
                    failed.push(`${label}: ${(epError as Error).message}`);
                }
            }

            setProgress(`Saving ${updates.length} updated analyses...`);
            await StorageService.batchUpdateAnalyses(updates);

            let message = `Re-Analysis Complete! Updated ${updates.length} episodes.`;
            if (failed.length > 0) {
                message += `\n\nFailed (${failed.length}):\n${failed.join('\n')}`;
            }
            alert(message);
            window.location.reload();

        } catch (e) {
            console.error("Re-Analysis Error:", e);
            alert("Re-Analysis failed. Check console.");
        } finally {
            setIsRunning(false);
            setProgress('');
            setCurrentTask(null);
        }
    };

    // --- NEW: Populate Contestants & Couples Collections ---
    const handlePopulateCollections = async () => {
        if (!confirm("This will populate the contestants and couples collections from existing analyses. Continue?")) return;

        setCurrentTask('populate');
        setIsRunning(true);
        setProgress('Fetching all analyses...');

        try {
            const allHistory = await StorageService.getHistory();

            if (allHistory.length === 0) {
                alert("No episodes found!");
                return;
            }

            setProgress(`Found ${allHistory.length} episodes. Processing...`);
            let totalContestants = 0;
            let totalCouples = 0;

            for (let i = 0; i < allHistory.length; i++) {
                const ep = allHistory[i];
                const label = ep.episodeNumber ? `Ep ${ep.episodeNumber}` : ep.episodeTitle;
                setProgress(`Processing ${label} (${i + 1}/${allHistory.length})...`);

                // Generate IDs if they don't exist
                const contestantsWithIds = ep.contestants?.map(c => ({
                    ...c,
                    id: c.id || crypto.randomUUID()  // Use existing ID or generate new
                })) || [];

                // Match couples to IDs
                const couplesWithIds = ep.couples?.map(couple => {
                    const c1 = contestantsWithIds.find(c => c.name === couple.person1);
                    const c2 = contestantsWithIds.find(c => c.name === couple.person2);

                    return {
                        ...couple,
                        contestant1Id: couple.contestant1Id || c1?.id || null,
                        contestant2Id: couple.contestant2Id || c2?.id || null
                    };
                }) || [];

                // Save to normalized collections
                if (contestantsWithIds.length > 0) {
                    await StorageService.saveContestants(
                        contestantsWithIds,
                        ep.id,
                        ep.episodeNumber,
                        ep.episodeTitle
                    );
                    totalContestants += contestantsWithIds.length;
                }

                if (couplesWithIds.length > 0) {
                    await StorageService.saveCouples(
                        couplesWithIds,
                        ep.id,
                        ep.episodeNumber,
                        ep.episodeTitle
                    );
                    totalCouples += couplesWithIds.length;
                }

                // Optionally update the analyses document with IDs (for consistency)
                if (contestantsWithIds.some(c => !ep.contestants?.find(ec => ec.id === c.id))) {
                    await StorageService.addAnalysis({
                        ...ep,
                        contestants: contestantsWithIds,
                        couples: couplesWithIds
                    });
                }
            }

            alert(`Migration Complete!\n\nCreated:\n- ${totalContestants} contestants\n- ${totalCouples} couples`);
            window.location.reload();

        } catch (e) {
            console.error("Population Error:", e);
            alert("Migration failed. Check console.");
        } finally {
            setIsRunning(false);
            setProgress('');
            setCurrentTask(null);
        }
    };

    return (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px dashed var(--primary-color)', borderRadius: '8px', background: 'rgba(193, 49, 17, 0.05)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--primary-color)' }}>🔧 Admin Tools</h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                <button
                    onClick={handleLocationMigration}
                    disabled={isRunning}
                    className="btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                >
                    {currentTask === 'locations' ? 'Migrating...' : '📍 Migrate Locations'}
                </button>

                <button
                    onClick={handleReAnalyzeAll}
                    disabled={isRunning}
                    className="btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                >
                    {currentTask === 'reanalyze' ? 'Re-Analyzing...' : '🔄 Re-Analyze All (Data Model Update)'}
                </button>

                <button
                    onClick={handlePopulateCollections}
                    disabled={isRunning}
                    className="btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                >
                    {currentTask === 'populate' ? 'Populating...' : '📊 Populate Contestants & Couples'}
                </button>
            </div>

            {progress && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted-color)', fontStyle: 'italic' }}>
                    {progress}
                </div>
            )}
        </div>
    );
};

