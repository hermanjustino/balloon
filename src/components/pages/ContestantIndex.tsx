import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatLocation, primaryJob, outcomeColor } from '../../utils/contestant';

interface ContestantSummary {
    id: string;
    name: string;
    age: string;
    location: { city?: string; state?: string } | string;
    jobs?: string[];
    job?: string;
    outcome?: string;
    episodeId: string;
    slug: string;
    partnerName?: string;
}


function epNum(episodeId: string): number {
    return episodeId?.startsWith('ep_') ? parseInt(episodeId.replace('ep_', '')) || 0 : 0;
}

function epLabel(episodeId: string): string {
    return episodeId?.startsWith('ep_') ? `Ep. ${episodeId.replace('ep_', '')}` : 'Classic';
}

export function ContestantIndex() {
    const [contestants, setContestants] = useState<ContestantSummary[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'matched' | 'single'>('all');
    const [episodeFilter, setEpisodeFilter] = useState('');

    useEffect(() => {
        fetch('/api/contestants')
            .then(r => r.json())
            .then(data => { setContestants(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Sorted unique episode options, newest first
    const episodeOptions = Array.from(new Set(contestants.map(c => c.episodeId))) as string[];
    episodeOptions.sort((a, b) => epNum(b) - epNum(a));

    const filtered = contestants.filter(c => {
        const q = search.toLowerCase();
        const loc = formatLocation(c.location).toLowerCase();
        const job = primaryJob(c).toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(q);
        const jobMatch = job.includes(q);
        const locMatch = loc.includes(q);
        const searchPass = !q || nameMatch || jobMatch || locMatch;

        const filterPass =
            filter === 'all' ? true :
            filter === 'matched' ? c.outcome === 'Matched' :
            c.outcome !== 'Matched';

        const episodePass = !episodeFilter || c.episodeId === episodeFilter;

        return searchPass && filterPass && episodePass;
    });

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '2rem 1.5rem' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <Link to="/" style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                        Luvlytics
                    </Link>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-color)', opacity: 0.55 }}>
                        {loading ? '…' : `${contestants.length} contestants`}
                    </span>
                </div>

                <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.25rem', color: 'var(--primary-color)', marginBottom: '1.5rem' }}>
                    All Contestants
                </h1>

                {/* Search + Filter row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Search name, job, or location…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            flex: '1', minWidth: '200px', padding: '0.7rem 1rem',
                            background: 'white', border: '1.5px solid rgba(193,49,17,0.2)',
                            borderRadius: '10px', fontSize: '1rem', fontFamily: 'Inter, sans-serif',
                            color: 'var(--text-color)', outline: 'none',
                        }}
                    />
                    <select
                        value={episodeFilter}
                        onChange={e => setEpisodeFilter(e.target.value)}
                        style={{
                            padding: '0.7rem 1rem', border: '1.5px solid rgba(193,49,17,0.2)',
                            borderRadius: '10px', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                            background: episodeFilter ? 'var(--surface-color)' : 'white',
                            color: episodeFilter ? '#EFE9E0' : 'var(--text-color)',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="">All episodes</option>
                        {episodeOptions.map(id => (
                            <option key={id} value={id}>{epLabel(id)}</option>
                        ))}
                    </select>
                    {(['all', 'matched', 'single'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '0.7rem 1.1rem', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500,
                                background: filter === f ? 'var(--surface-color)' : 'rgba(139,33,10,0.1)',
                                color: filter === f ? '#EFE9E0' : 'var(--text-color)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {f === 'all' ? 'All' : f === 'matched' ? 'Matched' : 'Not matched'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', opacity: 0.45, marginTop: '4rem' }}>Loading…</p>
                ) : filtered.length === 0 ? (
                    <p style={{ textAlign: 'center', opacity: 0.45, marginTop: '4rem' }}>No contestants found.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                        {(filtered as ContestantSummary[]).map(c => <ContestantCard key={c.id} c={c} />)}
                    </div>
                )}
            </div>
        </div>
    );
}

function ContestantCard({ c }: { c: ContestantSummary; key?: string }) {
    const location = formatLocation(c.location);
    const job = primaryJob(c);
    const epNum = c.episodeId?.replace('ep_', '') || '';
    const [hovered, setHovered] = useState(false);

    return (
        <Link to={`/contestants/${c.slug}`} style={{ textDecoration: 'none' }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: 'var(--surface-color)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    transform: hovered ? 'translateY(-2px)' : 'none',
                    boxShadow: hovered ? '0 8px 24px rgba(139,33,10,0.25)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', color: '#EFE9E0', lineHeight: 1.2, flex: 1 }}>
                        {c.name}
                    </h3>
                    {c.outcome && (
                        <span style={{
                            display: 'inline-block', padding: '0.2rem 0.55rem', flexShrink: 0, marginLeft: '0.5rem',
                            background: outcomeColor(c.outcome), color: 'white',
                            borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.03em',
                        }}>
                            {c.outcome}
                        </span>
                    )}
                </div>

                <div style={{ fontSize: '0.85rem', color: '#EFE9E0', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {(c.age || location) && (
                        <span>{[c.age ? `${c.age} yrs` : '', location].filter(Boolean).join(' · ')}</span>
                    )}
                    {job && <span>{job}</span>}
                    {epNum && (
                        <span style={{ marginTop: '0.35rem', opacity: 0.5, fontSize: '0.75rem' }}>Ep. {epNum}</span>
                    )}
                </div>
            </div>
        </Link>
    );
}
