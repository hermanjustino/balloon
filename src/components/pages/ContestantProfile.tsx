import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatLocation, primaryJob, outcomeColor } from '../../utils/contestant';

interface ContestantDetail {
    id: string;
    name: string;
    age: string;
    location: { city?: string; state?: string; country?: string } | string;
    jobs?: string[];
    job?: string;
    kids?: { hasKids: boolean; count: number };
    religion?: string;
    role?: string;
    outcome?: string;
    episodeId: string;
    slug: string;
    partnerName?: string;
    videoUrl?: string;
    episodeTitle?: string;
    episodeNumber?: string;
}


function StatBar({ label, rate }: { label: string; rate: number | null }) {
    // rate comes from BigQuery already as a percentage (e.g. 36.8), not a decimal
    const pct = rate != null ? Math.round(rate) : null;
    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-color)', opacity: 0.8 }}>{label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                    {pct != null ? `${pct}%` : '—'}
                </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(193,49,17,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', background: 'var(--primary-color)', borderRadius: '999px',
                    width: `${Math.min(pct ?? 0, 100)}%`, transition: 'width 0.6s ease',
                }} />
            </div>
        </div>
    );
}

export function ContestantProfile() {
    const { slug } = useParams<{ slug: string }>();
    const [contestant, setContestant] = useState<ContestantDetail | null>(null);
    const [industryData, setIndustryData] = useState<any[]>([]);
    const [ageMatchData, setAgeMatchData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!slug) return;
        Promise.all([
            fetch(`/api/contestants/${slug}`).then(r => r.ok ? r.json() : null),
            fetch('/api/stats/industries').then(r => r.json()).catch(() => []),
            fetch('/api/stats/age-match').then(r => r.json()).catch(() => []),
        ]).then(([c, industries, ageMatches]) => {
            if (!c) { setNotFound(true); }
            else { setContestant(c); setIndustryData(industries); setAgeMatchData(ageMatches); }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [slug]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', opacity: 0.45 }}>Loading…</p>
        </div>
    );

    if (notFound || !contestant) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <p style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)' }}>Contestant not found</p>
            <Link to="/contestants" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-color)', opacity: 0.6, textDecoration: 'none' }}>← All Contestants</Link>
        </div>
    );

    const c = contestant;
    const location = formatLocation(c.location);
    const job = primaryJob(c);
    // Use episodeNumber from analysis if available; fall back to parsing ep_N format from episodeId
    const epNum = c.episodeNumber || (c.episodeId?.startsWith('ep_') ? c.episodeId.replace('ep_', '') : '') || '';
    const oc = outcomeColor(c.outcome);

    // Match comparison stats from existing endpoints
    const ageNum = parseInt(c.age);
    const ageRow = !isNaN(ageNum)
        ? ageMatchData.find((r: any) => Math.abs(r.age - ageNum) <= 1)
        : null;
    const industryRow = job
        ? industryData.find((r: any) =>
            r.industry?.toLowerCase().includes(job.toLowerCase().split(' ')[0]) ||
            job.toLowerCase().includes((r.industry || '').toLowerCase().split(' ')[0])
        )
        : null;
    const hasComparisonStats = ageRow || industryRow;

    const cardStyle: React.CSSProperties = {
        background: 'var(--surface-color)',
        color: '#EFE9E0',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1.25rem',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.6,
        marginBottom: '0.5rem',
        fontFamily: 'Inter, sans-serif',
    };

    const valueStyle: React.CSSProperties = {
        fontFamily: 'DM Serif Display, serif',
        fontSize: '1.5rem',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '2rem 1.5rem' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                {/* Nav */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <Link to="/" style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                        Luvlytics
                    </Link>
                    <Link to="/contestants" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-color)', textDecoration: 'none', opacity: 0.6 }}>
                        All Contestants →
                    </Link>
                </div>

                {/* Profile header */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.5rem', color: 'var(--primary-color)', lineHeight: 1.1 }}>
                        {c.name}
                    </h1>
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '1rem', color: 'var(--text-color)', opacity: 0.72, fontFamily: 'Inter, sans-serif' }}>
                        {c.age && <span>{c.age} yrs</span>}
                        {location && <span>{location}</span>}
                        {job && <span>{job}</span>}
                    </div>
                    {c.outcome && (
                        <span style={{
                            display: 'inline-block', marginTop: '0.875rem',
                            padding: '0.28rem 0.9rem', borderRadius: '999px',
                            background: oc, color: 'white',
                            fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em',
                            fontFamily: 'Inter, sans-serif',
                        }}>
                            {c.outcome}
                        </span>
                    )}
                </div>

                {/* Match card — glassmorphism */}
                {c.outcome === 'Matched' && c.partnerName && (
                    <div style={{
                        background: 'rgba(139,33,10,0.12)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(193,49,17,0.25)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        marginBottom: '1.25rem',
                    }}>
                        <div style={{ ...labelStyle, color: 'var(--primary-color)', opacity: 0.8 }}>Matched with</div>
                        <div style={{ ...valueStyle, color: 'var(--primary-color)' }}>{c.partnerName}</div>
                        {epNum && (
                            <div style={{ marginTop: '0.3rem', fontSize: '0.875rem', color: 'var(--text-color)', opacity: 0.6, fontFamily: 'Inter, sans-serif' }}>
                                Episode {epNum}
                            </div>
                        )}
                    </div>
                )}

                {/* Episode card (when no match) */}
                {!(c.outcome === 'Matched' && c.partnerName) && epNum && (
                    <div style={cardStyle}>
                        <div style={labelStyle}>Episode</div>
                        <div style={valueStyle}>{epNum}</div>
                        {c.episodeTitle && (
                            <div style={{ marginTop: '0.3rem', fontSize: '0.875rem', opacity: 0.65, fontFamily: 'Inter, sans-serif' }}>{c.episodeTitle}</div>
                        )}
                    </div>
                )}

                {/* Comparison stats */}
                {hasComparisonStats && (
                    <div style={{ background: 'var(--secondary-card-color)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.25rem' }}>
                        <div style={{ ...labelStyle, color: 'var(--text-color)' }}>
                            How {c.name.split(' ')[0]} compares
                        </div>
                        {ageRow && (
                            <StatBar
                                label={`Age ${ageRow.age} match rate`}
                                rate={ageRow.matchRate}
                            />
                        )}
                        {industryRow && (
                            <StatBar
                                label={`${industryRow.industry} match rate`}
                                rate={industryRow.matchRate}
                            />
                        )}
                    </div>
                )}

                {/* Religion + Kids row */}
                {(c.religion || c.kids?.hasKids) && (
                    <div style={{ display: 'grid', gridTemplateColumns: c.religion && c.kids?.hasKids ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        {c.religion && (
                            <div style={cardStyle}>
                                <div style={labelStyle}>Religion</div>
                                <div style={valueStyle}>{c.religion}</div>
                            </div>
                        )}
                        {c.kids?.hasKids && (
                            <div style={cardStyle}>
                                <div style={labelStyle}>Kids</div>
                                <div style={valueStyle}>{c.kids.count || 'Yes'}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* CTA buttons */}
                <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {c.videoUrl && (
                        <a
                            href={c.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'block', padding: '1rem', background: 'var(--surface-color)',
                                color: '#EFE9E0', textAlign: 'center', textDecoration: 'none',
                                borderRadius: '12px', fontSize: '1rem', fontWeight: 600,
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            Watch Episode {epNum} on YouTube →
                        </a>
                    )}
                    <Link
                        to="/"
                        style={{
                            display: 'block', padding: '1rem', background: 'transparent',
                            color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)',
                            textAlign: 'center', textDecoration: 'none', borderRadius: '12px',
                            fontSize: '1rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        }}
                    >
                        View Full Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
