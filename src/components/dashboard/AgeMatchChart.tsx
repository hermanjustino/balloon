import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

interface AgeMatchRow {
    age: number;
    total: number;
    matched: number;
    matchRate: number | null;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as AgeMatchRow;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '10px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontWeight: 600, marginBottom: 4 }}>Age: {d.age}</p>
            <p style={{ color: 'rgba(239,233,224,0.8)', fontSize: 13 }}>Participants: {d.total}</p>
            <p style={{ color: '#448AFF', fontSize: 13 }}>Match rate: {d.matchRate?.toFixed(1) ?? '—'}%</p>
        </div>
    );
};

export const AgeMatchChart = React.memo(({ data }: { data: AgeMatchRow[] }) => {
    if (!data.length) return (
        <section className="card demographics-card">
            <h2 className="card-title">Age Match Rates</h2>
            <div className="empty-state" style={{ height: 260 }}>No age data available yet.</div>
        </section>
    );

    return (
        <section className="card demographics-card">
            <h2 className="card-title">Age Match Rates</h2>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" vertical={false} />
                    <XAxis dataKey="age" tick={{ fill: 'rgba(239,233,224,0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#EFE9E0', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="matchRate" radius={[4, 4, 0, 0]} fill="#C13111">
                        {data.map((entry, i) => (
                            <Cell
                                key={i}
                                fill={`hsl(20, 70%, ${40 + Math.min(entry.total, 10) * 3}%)`}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 11, color: 'rgba(239,233,224,0.4)', marginTop: 8 }}>
                Bar colour intensity reflects total participants at each age. Minimum 3 participants required.
            </p>
        </section>
    );
});
