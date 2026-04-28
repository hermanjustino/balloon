import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatLocation, primaryJob, outcomeColor } from '../../utils/contestant';

interface EpisodeDetail {
    id: string;
    episodeNumber: string;
    episodeTitle: string | null;
    matchRate: number | null;
    videoUrl: string | null;
    dramaScore: number | null;
    memorableMoment: string | null;
    contestants: ContestantSummary[];
}

interface ContestantSummary {
    id: string;
    name: string;
    age: string;
    location: { city?: string; state?: string; country?: string } | string;
    jobs?: string[];
    job?: string;
    outcome?: string;
    episodeId: string;
    slug: string;
    partnerName?: string;
}

export function EpisodePage() {
    const { id } = useParams<{ id: string }>();
    const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/episodes/${id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) setNotFound(true);
                else setEpisode(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', opacity: 0.45 }}>Loading…</p>
        </div>
    );

    if (notFound || !episode) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <p style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)' }}>Episode not found</p>
            <Link to="/episodes" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-color)', opacity: 0.6, textDecoration: 'none' }}>← All Episodes</Link>
        </div>
    );

    const e = episode;
    const matchPct = e.matchRate != null ? Math.round(e.matchRate) : null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '2rem 1.5rem' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                {/* Nav */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <Link to="/" style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                        Luvlytics
                    </Link>
                    <Link to="/episodes" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-color)', textDecoration: 'none', opacity: 0.6 }}>
                        ← All Episodes
                    </Link>
                </div>

                {/* Hero */}
                <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--primary-color)', opacity: 0.7, marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Episode {e.episodeNumber}
                    </p>
                    <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.5rem', color: 'var(--primary-color)', lineHeight: 1.1, marginBottom: '1.25rem' }}>
                        {e.episodeTitle || `Episode ${e.episodeNumber}`}
                    </h1>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {matchPct != null && (
                            <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '0.2rem' }}>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#EFE9E0', opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Match Rate</span>
                                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.75rem', color: '#EFE9E0' }}>{matchPct}%</span>
                            </div>
                        )}
                        {e.contestants.length > 0 && (
                            <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '0.2rem' }}>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#EFE9E0', opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Contestants</span>
                                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.75rem', color: '#EFE9E0' }}>{e.contestants.length}</span>
                            </div>
                        )}
                        {e.dramaScore != null && (
                            <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '0.2rem' }}>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#EFE9E0', opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Drama Score</span>
                                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.75rem', color: '#EFE9E0' }}>{e.dramaScore.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Memorable moment */}
                {e.memorableMoment && (
                    <div style={{
                        background: 'rgba(139,33,10,0.12)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(193,49,17,0.25)',
                        borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem',
                    }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', opacity: 0.6, marginBottom: '0.5rem', color: 'var(--text-color)' }}>
                            Memorable Moment
                        </div>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: 'var(--text-color)', lineHeight: 1.6, margin: 0 }}>
                            {e.memorableMoment}
                        </p>
                    </div>
                )}

                {/* YouTube CTA */}
                {e.videoUrl && (
                    <a href={e.videoUrl} target="_blank" rel="noopener noreferrer" style={{
                        display: 'block', padding: '1rem', background: 'var(--surface-color)',
                        color: '#EFE9E0', textAlign: 'center', textDecoration: 'none',
                        borderRadius: '12px', fontSize: '1rem', fontWeight: 600,
                        fontFamily: 'Inter, sans-serif', marginBottom: '2rem',
                    }}>
                        Watch Episode {e.episodeNumber} on YouTube →
                    </a>
                )}

                {/* Contestant grid */}
                {e.contestants.length > 0 && (
                    <>
                        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                            Contestants
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem', marginBottom: '2.5rem' }}>
                            {e.contestants.map(c => <EpisodeContestantCard key={c.id} c={c} />)}
                        </div>
                    </>
                )}

                {/* Back CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Link to="/episodes" style={{
                        display: 'block', padding: '1rem', background: 'transparent',
                        color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)',
                        textAlign: 'center', textDecoration: 'none', borderRadius: '12px',
                        fontSize: '1rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    }}>
                        ← All Episodes
                    </Link>
                    <Link to="/" style={{
                        display: 'block', padding: '1rem', background: 'transparent',
                        color: 'var(--text-color)', border: '1px solid rgba(62,39,35,0.2)',
                        textAlign: 'center', textDecoration: 'none', borderRadius: '12px',
                        fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', opacity: 0.7,
                    }}>
                        View Full Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}

function EpisodeContestantCard({ c }: { c: ContestantSummary; key?: string }) {
    const location = formatLocation(c.location);
    const job = primaryJob(c);
    const [hovered, setHovered] = useState(false);

    return (
        <Link to={`/contestants/${c.slug}`} style={{ textDecoration: 'none' }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: 'var(--surface-color)', borderRadius: '14px', padding: '1rem',
                    transform: hovered ? 'translateY(-2px)' : 'none',
                    boxShadow: hovered ? '0 6px 20px rgba(139,33,10,0.25)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', color: '#EFE9E0', lineHeight: 1.2, flex: 1 }}>
                        {c.name}
                    </h3>
                    {c.outcome && (
                        <span style={{
                            display: 'inline-block', padding: '0.15rem 0.5rem', flexShrink: 0, marginLeft: '0.5rem',
                            background: outcomeColor(c.outcome), color: 'white',
                            borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                        }}>
                            {c.outcome}
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#EFE9E0', opacity: 0.65, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    {(c.age || location) && <span>{[c.age ? `${c.age} yrs` : '', location].filter(Boolean).join(' · ')}</span>}
                    {job && <span>{job}</span>}
                </div>
            </div>
        </Link>
    );
}
