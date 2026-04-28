import React, { useState } from 'react';

interface DealbreakersRow { category: string; reason: string; count: number; }

const CATEGORY_COLORS: Record<string, string> = {
    Appearance:   '#FF5252',
    Lifestyle:    '#FFA726',
    Vibe:         '#AB47BC',
    Location:     '#448AFF',
    Dealbreaker:  '#EF5350',
    Other:        '#78909C',
};

export const DealbreakersChart = React.memo(({ data }: { data: DealbreakersRow[] }) => {
    const [view, setView] = useState<'reasons' | 'categories'>('reasons');

    if (!data.length) return (
        <section className="card table-card">
            <h2 className="card-title">Top Reasons People Get Popped</h2>
            <div className="empty-state" style={{ height: 200 }}>No dealbreaker data yet — backfill pending.</div>
        </section>
    );

    // Category rollup
    const categoryMap: Record<string, number> = {};
    for (const row of data) {
        categoryMap[row.category] = (categoryMap[row.category] ?? 0) + row.count;
    }
    const categories = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

    const maxCount = view === 'reasons' ? (data[0]?.count ?? 1) : (categories[0]?.count ?? 1);
    const displayData = view === 'reasons'
        ? data.slice(0, 15).map(r => ({ label: r.reason, count: r.count, category: r.category }))
        : categories.map(c => ({ label: c.category, count: c.count, category: c.category }));

    return (
        <section className="card table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ marginBottom: 0 }}>Top Reasons People Get Popped</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['reasons', 'categories'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                background: view === v ? '#C13111' : 'transparent',
                                border: '1px solid #C13111',
                                color: '#EFE9E0',
                                padding: '4px 12px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontFamily: 'Inter, sans-serif',
                                textTransform: 'capitalize',
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displayData.map((item, i) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                            width: 22, fontSize: 12,
                            color: 'rgba(239,233,224,0.4)', textAlign: 'right', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{
                            flex: '1 1 auto', maxWidth: view === 'reasons' ? 220 : 120, minWidth: 60,
                            fontSize: 13, color: '#EFE9E0', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={item.label}>{item.label}</span>
                        <div style={{
                            flex: 1, height: 8, background: 'rgba(239,233,224,0.08)',
                            borderRadius: 4, overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${(item.count / maxCount) * 100}%`,
                                height: '100%',
                                background: CATEGORY_COLORS[item.category] ?? '#C13111',
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                            }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(239,233,224,0.6)', width: 24, textAlign: 'right', flexShrink: 0 }}>
                            {item.count}
                        </span>
                        {view === 'reasons' && (
                            <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                                background: `${CATEGORY_COLORS[item.category] ?? '#C13111'}22`,
                                color: CATEGORY_COLORS[item.category] ?? '#C13111',
                                flexShrink: 0,
                            }}>{item.category}</span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
});
