import React, { useState } from 'react';

interface EpisodeRow {
    episodeNumber: string;
    episodeTitle: string;
    matchRate: number | null;
    dramaScore: number | null;
    videoUrl: string;
}

const StarBar = ({ score }: { score: number }) => (
    <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }).map((_, i) => (
            <div
                key={i}
                style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: i < Math.round(score) ? '#FFA726' : 'rgba(239,233,224,0.15)',
                }}
            />
        ))}
        <span style={{ marginLeft: 6, fontSize: 12, color: 'rgba(239,233,224,0.7)' }}>{score}/10</span>
    </div>
);

export const BestEpisodesTable = React.memo(({ data }: { data: EpisodeRow[] }) => {
    const [sortBy, setSortBy] = useState<'matchRate' | 'dramaScore'>('matchRate');

    const sorted = [...data].sort((a, b) => {
        const av = a[sortBy] ?? -1;
        const bv = b[sortBy] ?? -1;
        return bv - av;
    }).slice(0, 15);

    if (!sorted.length) return (
        <section className="card table-card">
            <h2 className="card-title">Top Episodes</h2>
            <div className="empty-state" style={{ height: 200 }}>No episode data.</div>
        </section>
    );

    return (
        <section className="card table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ marginBottom: 0 }}>Top Episodes</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['matchRate', 'dramaScore'] as const).map(key => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key)}
                            style={{
                                background: sortBy === key ? '#C13111' : 'transparent',
                                border: '1px solid #C13111',
                                color: '#EFE9E0',
                                padding: '4px 12px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            {key === 'matchRate' ? 'By Match Rate' : 'By Drama Score'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Episode</th>
                            <th>Match Rate</th>
                            <th>Drama Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((ep, i) => (
                            <tr key={ep.episodeNumber} className="row-clickable" onClick={() => ep.videoUrl && window.open(ep.videoUrl, '_blank')}>
                                <td style={{ color: 'rgba(239,233,224,0.5)', width: 32 }}>{i + 1}</td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>Ep {ep.episodeNumber}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(239,233,224,0.6)', marginTop: 2 }}>
                                        {ep.episodeTitle}
                                    </div>
                                </td>
                                <td>
                                    {ep.matchRate != null ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{
                                                width: `${Math.min(ep.matchRate, 100)}%`,
                                                maxWidth: 80,
                                                height: 6,
                                                background: '#448AFF',
                                                borderRadius: 3,
                                                minWidth: 4,
                                            }} />
                                            <span style={{ fontSize: 13 }}>{ep.matchRate.toFixed(0)}%</span>
                                        </div>
                                    ) : <span style={{ color: 'rgba(239,233,224,0.3)' }}>—</span>}
                                </td>
                                <td>
                                    {ep.dramaScore != null
                                        ? <StarBar score={ep.dramaScore} />
                                        : <span style={{ color: 'rgba(239,233,224,0.3)', fontSize: 12 }}>Not yet rated</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
});
