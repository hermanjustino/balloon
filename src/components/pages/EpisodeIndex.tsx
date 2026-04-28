import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface EpisodeSummary {
    id: string;
    episodeNumber: string;
    episodeTitle: string | null;
    matchRate: number | null;
    videoUrl: string | null;
    dramaScore: number | null;
    contestantCount: number;
}

export function EpisodeIndex() {
    const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/episodes')
            .then(r => r.json())
            .then(data => { setEpisodes(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '2rem 1.5rem' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <Link to="/" style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                        Luvlytics
                    </Link>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-color)', opacity: 0.55 }}>
                        {loading ? '…' : `${episodes.length} episodes`}
                    </span>
                </div>

                <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.25rem', color: 'var(--primary-color)', marginBottom: '2rem' }}>
                    All Episodes
                </h1>

                {loading ? (
                    <p style={{ textAlign: 'center', opacity: 0.45, marginTop: '4rem', fontFamily: 'Inter, sans-serif' }}>Loading…</p>
                ) : episodes.length === 0 ? (
                    <p style={{ textAlign: 'center', opacity: 0.45, marginTop: '4rem', fontFamily: 'Inter, sans-serif' }}>No episodes found.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                        {episodes.map(ep => <EpisodeCard key={ep.id} ep={ep} />)}
                    </div>
                )}
            </div>
        </div>
    );
}

function EpisodeCard({ ep }: { ep: EpisodeSummary; key?: string }) {
    const [hovered, setHovered] = useState(false);
    const matchPct = ep.matchRate != null ? Math.round(ep.matchRate) : null;

    return (
        <Link to={`/episodes/${ep.episodeNumber}`} style={{ textDecoration: 'none' }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: 'var(--surface-color)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    transform: hovered ? 'translateY(-2px)' : 'none',
                    boxShadow: hovered ? '0 8px 24px rgba(139,33,10,0.25)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    display: 'flex',
                    flexDirection: 'column' as const,
                    gap: '0.5rem',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', color: 'var(--primary-color)', lineHeight: 1 }}>
                        Ep. {ep.episodeNumber}
                    </span>
                    {matchPct != null && (
                        <span style={{
                            fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600,
                            color: matchPct >= 50 ? '#4ade80' : matchPct >= 30 ? '#fbbf24' : '#EFE9E0',
                            opacity: 0.9,
                        }}>
                            {matchPct}% matched
                        </span>
                    )}
                </div>
                {ep.episodeTitle && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#EFE9E0', opacity: 0.75, lineHeight: 1.4, margin: 0 }}>
                        {ep.episodeTitle}
                    </p>
                )}
                {ep.contestantCount > 0 && (
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#EFE9E0', opacity: 0.45, marginTop: '0.25rem' }}>
                        {ep.contestantCount} contestants
                    </span>
                )}
            </div>
        </Link>
    );
}
