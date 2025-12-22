import React, { useState, useMemo } from 'react';
import { AnalysisResult } from '../../types';

type SortKey = 'episodeNumber' | 'episodeTitle' | 'matchesCount' | 'participantCount';
type SortDirection = 'asc' | 'desc';

export const AnalysisTable = ({ recentAnalyses, onSelectEpisode, isAdmin, onDelete }: { recentAnalyses: AnalysisResult[], onSelectEpisode: (ep: AnalysisResult) => void, isAdmin?: boolean, onDelete?: (id: string, hasTranscript: boolean) => void }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

    const sortedData = useMemo(() => {
        if (!sortConfig) return recentAnalyses;

        return [...recentAnalyses].sort((a, b) => {
            const { key, direction } = sortConfig;

            let aValue: any = a[key];
            let bValue: any = b[key];

            // Special handling for Episode Number (convert string to int for proper sorting)
            if (key === 'episodeNumber') {
                aValue = parseInt(aValue || '0', 10);
                bValue = parseInt(bValue || '0', 10);
            }

            // Handle undefined/nulls
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';

            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [recentAnalyses, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return <span style={{ opacity: 0.3, marginLeft: '5px' }}>⇅</span>;
        return <span style={{ marginLeft: '5px' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const headerStyle = { cursor: 'pointer', userSelect: 'none' } as React.CSSProperties;

    return (
        <section className="card table-card">
            <h2 className="card-title">Episodes</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted-color)', fontSize: '0.9rem' }}>Click a row to view contestant details</p>
            {sortedData && sortedData.length > 0 ? (
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={headerStyle} onClick={() => requestSort('episodeNumber')}>
                                    Ep #{getSortIndicator('episodeNumber')}
                                </th>
                                <th style={headerStyle} onClick={() => requestSort('episodeTitle')}>
                                    Title{getSortIndicator('episodeTitle')}
                                </th>
                                <th style={headerStyle} onClick={() => requestSort('matchesCount')}>
                                    Matches{getSortIndicator('matchesCount')}
                                </th>
                                <th style={headerStyle} onClick={() => requestSort('participantCount')}>
                                    Participants{getSortIndicator('participantCount')}
                                </th>
                                {isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((item, index) => {
                                return (
                                    <tr
                                        key={`${item.id}-${index}`}
                                        onClick={() => onSelectEpisode(item)}
                                        className="row-clickable"
                                    >
                                        <td style={{ fontWeight: 'bold', color: 'var(--bg-color)' }}>
                                            {item.episodeNumber ? item.episodeNumber : '-'}
                                        </td>
                                        <td>{item.episodeTitle}</td>
                                        <td>{item.matchesCount}</td>
                                        <td>{item.participantCount}</td>
                                        {isAdmin && (
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="delete-btn-icon"
                                                    title="Delete this episode"
                                                    onClick={() => onDelete && onDelete(item.id, !!(item.hasTranscript || item.transcriptUrl))}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>No episodes recorded.</div>
            )}
        </section>
    );
};
