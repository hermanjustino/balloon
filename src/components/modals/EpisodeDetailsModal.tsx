import React, { useState } from 'react';
import { AnalysisResult } from '../../types';
import { StorageService } from '../../services';
import { ContestantList } from '../shared/ContestantList';

export const EpisodeDetailsModal = ({ episode, onClose, isAdmin }: { episode: AnalysisResult, onClose: () => void, isAdmin: boolean }) => {
    const displayTitle = episode.episodeNumber
        ? `Episode ${episode.episodeNumber}: ${episode.episodeTitle}`
        : episode.episodeTitle;

    const [transcriptText, setTranscriptText] = useState<string | null>(episode.transcript || null);
    const [loadingTranscript, setLoadingTranscript] = useState(false);

    // Split contestants by role
    const allParticipants = episode.contestants || [];
    const lineup = allParticipants.filter(c => c.role === 'Lineup');
    const incoming = allParticipants.filter(c => c.role === 'Contestant');
    const unclassified = allParticipants.filter(c => !c.role);

    const handleToggleTranscript = async () => {
        // Fetch if we don't have text yet, but we know it exists (Legacy URL or New Flag)
        const canFetch = !transcriptText && (episode.transcriptUrl || episode.hasTranscript);

        if (canFetch && !loadingTranscript) {
            setLoadingTranscript(true);
            try {
                const text = await StorageService.loadTranscript(episode);
                setTranscriptText(text);
            } catch (e) {
                setTranscriptText("Failed to load transcript.");
            } finally {
                setLoadingTranscript(false);
            }
        }
    }

    // Determine if transcript section should be shown
    const showTranscriptSection = isAdmin && (episode.transcript || episode.transcriptUrl || episode.hasTranscript);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{displayTitle}</h2>
                        <div style={{ color: 'var(--text-muted-color)' }}>
                            Analyzed on {episode.dateAnalyzed} • {episode.participantCount} Participants • {episode.matchesCount} Matches
                            {episode.videoUrl && (
                                <span style={{ marginLeft: '10px' }}>
                                    • <a href={episode.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--secondary-color)', textDecoration: 'none' }}>Watch Video ↗</a>
                                </span>
                            )}
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {/* Matches Section */}
                {episode.couples && episode.couples.length > 0 && (
                    <div className="matches-section">
                        <h3 className="section-title" style={{ borderBottom: 'none', marginBottom: '1rem' }}>❤️ Successful Matches</h3>
                        <div className="matches-grid">
                            {episode.couples.map((couple, idx) => (
                                <div className="match-pill" key={idx}>
                                    <span>{couple.person1}</span>
                                    <span className="match-heart">💞</span>
                                    <span>{couple.person2}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {allParticipants.length > 0 ? (
                    <div className="modal-columns">
                        <ContestantList title="The Lineup (Balloon Holders)" contestants={lineup.length ? lineup : unclassified} isAdmin={isAdmin} />
                        {(incoming.length > 0 || lineup.length > 0) && (
                            <ContestantList title="The Incoming Contestants" contestants={incoming} isAdmin={isAdmin} />
                        )}
                    </div>
                ) : (
                    <div className="empty-state" style={{ height: '200px' }}>
                        No detailed contestant data available for this analysis. <br />
                        (Try re-analyzing the episode to extract profiles)
                    </div>
                )}

                {/* Transcript Section - ADMIN ONLY */}
                {showTranscriptSection && (
                    <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) handleToggleTranscript() }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--text-muted-color)', fontWeight: 500 }}>
                                View Full Transcript (Admin Only) {loadingTranscript && <span style={{ marginLeft: '10px', fontSize: '0.8rem' }}>Loading...</span>}
                            </summary>
                            <div className="transcript-box">
                                {loadingTranscript ? "Fetching transcript from cloud..." : transcriptText}
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
};
