import React from 'react';
import { Contestant } from '../../types';

export const ContestantList = React.memo(({ title, contestants }: { title: string, contestants: Contestant[] }) => (
    <div>
        <h3 className="section-title">{title}</h3>
        <div className="contestant-grid">
            {contestants.map((c, idx) => (
                <div className="contestant-card" key={idx}>
                    <div className="c-name">{c.name}</div>
                    <div className="c-meta">
                        <span>{c.age !== 'Unknown' ? `${c.age} y/o` : 'Age N/A'}</span>
                        {c.location !== 'Unknown' && <span>• {c.location}</span>}
                    </div>
                    {c.job && <div className="c-job">{c.job}</div>}
                    <div className={`c-outcome ${c.outcome?.toLowerCase().includes('match') ? 'outcome-matched' : 'outcome-popped'}`}>
                        {c.outcome || 'Unknown'}
                    </div>
                </div>
            ))}
            {contestants.length === 0 && <div style={{ fontStyle: 'italic', color: 'var(--text-muted-color)' }}>No participants found for this group.</div>}
        </div>
    </div>
));
