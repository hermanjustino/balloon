import React from 'react';

interface KidsData {
    totalWithData: number;
    hasKidsCount: number;
    pctWithKids: number;
    avgKidCount: number | null;
}

export const KidsStats = React.memo(({ data }: { data: KidsData | null }) => {
    if (!data) return null;

    const stats = [
        {
            value: `${data.pctWithKids}%`,
            label: 'Have Kids',
            sub: `${data.hasKidsCount} of ${data.totalWithData} with data`,
        },
        {
            value: data.avgKidCount != null ? data.avgKidCount.toFixed(1) : '—',
            label: 'Avg Kids (among parents)',
            sub: 'Corrupted values excluded',
        },
    ];

    return (
        <>
            {stats.map(s => (
                <article className="card metric-card" key={s.label}>
                    <div className="value" style={{ fontSize: '2rem' }}>{s.value}</div>
                    <div className="label">{s.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(239,233,224,0.5)', marginTop: 4 }}>
                        {s.sub}
                    </div>
                </article>
            ))}
        </>
    );
});
