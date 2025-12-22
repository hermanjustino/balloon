import React, { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { AnalysisResult, Contestant } from '../../types';

interface ContestantWithEpisode extends Contestant {
    episodeNumber?: string;
    episodeTitle?: string;
}

interface ContestantSearchProps {
    history: AnalysisResult[];
    onBack: () => void;
}

export const ContestantSearch: React.FC<ContestantSearchProps> = ({ history, onBack }) => {
    const [query, setQuery] = useState('');

    // Flatten all contestants and add episode info
    const allContestants = useMemo(() => {
        const contestants: ContestantWithEpisode[] = [];
        history.forEach(ep => {
            ep.contestants?.forEach(c => {
                contestants.push({
                    ...c,
                    episodeNumber: ep.episodeNumber,
                    episodeTitle: ep.episodeTitle
                });
            });
        });
        return contestants;
    }, [history]);

    // Setup Fuse.js for fuzzy search
    const fuse = useMemo(() => new Fuse(allContestants, {
        keys: ['name', 'job', 'jobs', 'location.city', 'location.state'],
        threshold: 0.3
    }), [allContestants]);

    // Get search results
    const results = useMemo(() => {
        if (!query.trim()) return allContestants.slice(0, 50); // Show first 50 if no query
        return fuse.search(query).map(r => r.item);
    }, [query, fuse, allContestants]);

    const getJobDisplay = (c: Contestant): string => {
        if (c.jobs && c.jobs.length > 0) return c.jobs.join(', ');
        if (c.job) return c.job;
        return 'N/A';
    };

    const getLocationDisplay = (c: Contestant): string => {
        if (typeof c.location === 'string') return c.location;
        return `${c.location.city}, ${c.location.state}`;
    };

    return (
        <div className="container">
            <header className="header">
                <div className="header-brand">
                    <button className="back-btn" onClick={onBack}>&larr; Back</button>
                    <h1>🔍 Contestant Search</h1>
                </div>
            </header>

            <div style={{ marginBottom: '2rem' }}>
                <input
                    type="text"
                    placeholder="Search by name, job, or location..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#EFE9E0',
                        color: '#3E2723'
                    }}
                />
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted-color)', fontSize: '0.9rem' }}>
                    Showing {results.length} of {allContestants.length} contestants
                </p>
            </div>

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Location</th>
                            <th>Job(s)</th>
                            <th>Episode</th>
                            <th>Outcome</th>
                            <th>Kids</th>
                            <th>Religion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((c, idx) => (
                            <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td>{c.age}</td>
                                <td>{getLocationDisplay(c)}</td>
                                <td>{getJobDisplay(c)}</td>
                                <td>{c.episodeNumber ? `Ep ${c.episodeNumber}` : c.episodeTitle || 'N/A'}</td>
                                <td>
                                    <span className={`sentiment-badge ${c.outcome?.toLowerCase().includes('match') ? 'sentiment-positive' : 'sentiment-negative'}`}>
                                        {c.outcome || 'Unknown'}
                                    </span>
                                </td>
                                <td>
                                    {c.kids?.hasKids
                                        ? `${c.kids.count}${c.kids.ages?.length > 0 ? ` (${c.kids.ages.join(', ')})` : ''}`
                                        : '-'}
                                </td>
                                <td>{c.religion || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {results.length === 0 && (
                <div className="empty-state" style={{ padding: '3rem' }}>
                    No contestants found matching "{query}"
                </div>
            )}
        </div>
    );
};
