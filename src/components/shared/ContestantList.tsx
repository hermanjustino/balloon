import React from 'react';
import { Contestant } from '../../types';

interface ContestantListProps {
    title: string;
    contestants: Contestant[];
    isAdmin?: boolean;
}

export const ContestantList = React.memo(({ title, contestants, isAdmin }: ContestantListProps) => {
    const getJobDisplay = (c: Contestant): string | null => {
        if (c.jobs && c.jobs.length > 0) return c.jobs.join(', ');
        if (c.job) return c.job;
        return null;
    };

    return (
        <div>
            <h3 className="section-title">{title}</h3>
            <div className="contestant-grid">
                {contestants.map((c, idx) => (
                    <div className="contestant-card" key={idx}>
                        <div className="c-name">{c.name}</div>
                        <div className="c-meta">
                            <span>{c.age !== 'Unknown' ? `${c.age} y/o` : 'Age N/A'}</span>
                            {typeof c.location === 'string' && c.location !== 'Unknown' && <span>• {c.location}</span>}
                            {typeof c.location !== 'string' && <span>• {c.location.city}, {c.location.state}</span>}
                        </div>
                        {getJobDisplay(c) && <div className="c-job">{getJobDisplay(c)}</div>}

                        {/* Admin-Only Extended Fields */}
                        {isAdmin && c.kids?.hasKids && (
                            <div className="c-meta" style={{ marginTop: '0.25rem' }}>
                                👶 {c.kids.count} kid{c.kids.count !== 1 ? 's' : ''}
                                {c.kids.ages?.length > 0 && ` (Ages: ${c.kids.ages.join(', ')})`}
                            </div>
                        )}
                        {isAdmin && c.religion && (
                            <div className="c-meta" style={{ marginTop: '0.25rem' }}>🙏 {c.religion}</div>
                        )}

                        <div className={`c-outcome ${c.outcome?.toLowerCase().includes('match') ? 'outcome-matched' : 'outcome-popped'}`}>
                            {c.outcome || 'Unknown'}
                        </div>
                    </div>
                ))}
                {contestants.length === 0 && <div style={{ fontStyle: 'italic', color: 'var(--text-muted-color)' }}>No participants found for this group.</div>}
            </div>
        </div>
    );
});

