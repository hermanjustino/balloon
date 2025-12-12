import React from 'react';
import { Metrics } from '../../types';

export const KeyMetrics = React.memo(({ metrics }: { metrics: Metrics }) => {
    const safeMetrics = metrics || { episodesAnalyzed: 0, overallMatchRate: '-', avgAge: '-', totalParticipants: 0 };

    const displayMetrics = [
        { label: 'Episodes Analyzed', value: safeMetrics.episodesAnalyzed?.toString() || '0' },
        { label: 'Overall Match Rate', value: typeof safeMetrics.overallMatchRate === 'number' ? `${Math.round(safeMetrics.overallMatchRate)}%` : safeMetrics.overallMatchRate },
        { label: 'Avg. Contestant Age', value: typeof safeMetrics.avgAge === 'number' ? safeMetrics.avgAge.toFixed(1) : safeMetrics.avgAge },
        { label: 'Total Participants', value: safeMetrics.totalParticipants?.toString() || '0' },
    ];
    return (
        <section className="key-metrics-grid" aria-label="Key Metrics">
            {displayMetrics.map(metric => (
                <article className="card metric-card" key={metric.label}>
                    <div className="value">{metric.value}</div>
                    <div className="label">{metric.label}</div>
                </article>
            ))}
        </section>
    );
});
