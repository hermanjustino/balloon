import React, { useState, useMemo } from 'react';
import { AnalysisResult } from '../../types';

type SortKey = 'episodeNumber' | 'episodeTitle' | 'matchesCount' | 'participantCount';
type SortDirection = 'asc' | 'desc';

export const AnalysisTable = ({ recentAnalyses, onSelectEpisode, isAdmin, onDelete }: { recentAnalyses: AnalysisResult[], onSelectEpisode: (ep: AnalysisResult) => void, isAdmin?: boolean, onDelete?: (id: string, hasTranscript: boolean) => void }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'episodeNumber', direction: 'desc' });
    const [showFullList, setShowFullList] = useState(false);

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

    const dashboardData = useMemo(() => sortedData.slice(0, 10), [sortedData]);

    const renderTable = (data: AnalysisResult[], isModal: boolean = false) => (
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
                    {data.map((item, index) => (
                        <tr
                            key={`${item.id}-${index}`}
                            onClick={() => {
                                onSelectEpisode(item);
                                if (isModal) setShowFullList(false);
                            }}
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
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <section className="card table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>Episodes</h2>
                    <p style={{ color: 'var(--text-muted-color)', fontSize: '0.9rem' }}>Click a row to view contestant details</p>
                </div>
                {sortedData.length > 10 && (
                    <button 
                        className="view-toggle" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        onClick={() => setShowFullList(true)}
                    >
                        See All {sortedData.length}
                    </button>
                )}
            </div>

            {dashboardData && dashboardData.length > 0 ? (
                <>
                    {renderTable(dashboardData)}
                    {sortedData.length > 10 && (
                        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                            <button 
                                className="back-btn" 
                                style={{ width: '100%', maxWidth: '200px' }}
                                onClick={() => setShowFullList(true)}
                            >
                                View All Episodes
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>No episodes recorded.</div>
            )}

            {/* Full List Modal */}
            {showFullList && (
                <div className="modal-backdrop" onClick={() => setShowFullList(false)}>
                    <div className="modal-content" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>All Episodes</h2>
                                <p style={{ color: 'var(--text-muted-color)', fontSize: '0.9rem' }}>
                                    Showing all {sortedData.length} recorded analyses
                                </p>
                            </div>
                            <button className="close-btn" onClick={() => setShowFullList(false)}>&times;</button>
                        </div>
                        <div style={{ marginTop: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {renderTable(sortedData, true)}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
