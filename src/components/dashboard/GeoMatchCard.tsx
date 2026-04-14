import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface GeoData {
    sameState: number;
    diffState: number;
    unknownState: number;
    total: number;
    pctSameState: number;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '8px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontSize: 13 }}>
                {payload[0].name}: <strong>{payload[0].value}</strong>
            </p>
        </div>
    );
};

export const GeoMatchCard = React.memo(({ data }: { data: GeoData | null }) => {
    if (!data) return null;

    const known = data.sameState + data.diffState;
    if (known === 0) return (
        <section className="card demographics-card">
            <h2 className="card-title">Geographic Match Patterns</h2>
            <div className="empty-state" style={{ height: 200 }}>Insufficient location data.</div>
        </section>
    );

    const pieData = [
        { name: 'Same State', value: data.sameState, color: '#448AFF' },
        { name: 'Different State', value: data.diffState, color: '#C13111' },
    ];

    return (
        <section className="card demographics-card">
            <h2 className="card-title">Geographic Match Patterns</h2>
            <p style={{ fontSize: 12, color: 'rgba(239,233,224,0.5)', marginBottom: 8, marginTop: -8 }}>
                {known} couples with known states · {data.unknownState} excluded (unknown location)
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                        <Pie
                            data={pieData} dataKey="value"
                            innerRadius={45} outerRadius={70}
                            paddingAngle={3}
                        >
                            {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>

                <div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#448AFF', lineHeight: 1 }}>
                        {data.pctSameState}%
                    </div>
                    <div style={{ color: 'rgba(239,233,224,0.8)', fontSize: 13, marginTop: 4 }}>
                        of matches are same-state
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pieData.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                                <span style={{ color: 'rgba(239,233,224,0.8)' }}>{d.name}: </span>
                                <strong style={{ color: '#EFE9E0' }}>{d.value}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
});
