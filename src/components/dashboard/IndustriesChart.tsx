import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

interface IndustryRow {
    industry: string;
    total: number;
    matched: number;
    matchRate: number | null;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as IndustryRow;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '10px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontWeight: 600, marginBottom: 4 }}>{d.industry}</p>
            <p style={{ color: 'rgba(239,233,224,0.8)', fontSize: 13 }}>Participants: {d.total}</p>
            <p style={{ color: '#448AFF', fontSize: 13 }}>Match rate: {d.matchRate?.toFixed(1) ?? '—'}%</p>
        </div>
    );
};

export const IndustriesChart = React.memo(({ data }: { data: IndustryRow[] }) => {
    if (!data.length) return (
        <section className="card demographics-card">
            <h2 className="card-title">Industry Distribution</h2>
            <div className="empty-state" style={{ height: 260 }}>No industry data yet — backfill pending.</div>
        </section>
    );

    return (
        <section className="card demographics-card">
            <h2 className="card-title">Industry Distribution</h2>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'rgba(239,233,224,0.6)', fontSize: 11 }} />
                    <YAxis
                        type="category" dataKey="industry" width={100}
                        tick={{ fill: '#EFE9E0', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#C13111">
                        {data.map((entry, i) => (
                            <Cell
                                key={i}
                                fill={`hsl(${10 + i * 22}, 70%, ${40 + (entry.matchRate ?? 0) * 0.3}%)`}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 11, color: 'rgba(239,233,224,0.4)', marginTop: 8 }}>
                Bar colour intensity reflects match rate within each industry.
            </p>
        </section>
    );
});
