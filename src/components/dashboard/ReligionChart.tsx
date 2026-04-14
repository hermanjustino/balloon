import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = [
    '#C13111', '#FF7043', '#FFA726', '#FFCA28',
    '#AB47BC', '#7E57C2', '#448AFF', '#26A69A',
    '#66BB6A', '#EF5350', '#8D6E63', '#78909C',
];

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '8px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontSize: 13 }}>
                {payload[0].payload.religion}: <strong>{payload[0].value}</strong>
            </p>
        </div>
    );
};

export const ReligionChart = React.memo(({ data }: { data: { religion: string; count: number }[] }) => {
    if (!data.length) return (
        <section className="card demographics-card">
            <h2 className="card-title">Religion Breakdown</h2>
            <div className="empty-state" style={{ height: 220 }}>No religion data.</div>
        </section>
    );

    const total = data.reduce((s, d) => s + d.count, 0);

    return (
        <section className="card demographics-card">
            <h2 className="card-title">Religion Breakdown</h2>
            <p style={{ fontSize: 12, color: 'rgba(239,233,224,0.5)', marginBottom: 12, marginTop: -8 }}>
                Based on {total} participants who mentioned religion ({Math.round(total / 14.22)}% of total)
            </p>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'rgba(239,233,224,0.6)', fontSize: 11 }} />
                    <YAxis
                        type="category" dataKey="religion" width={90}
                        tick={{ fill: '#EFE9E0', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </section>
    );
});
