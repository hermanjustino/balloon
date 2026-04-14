import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '8px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontSize: 13 }}>
                {label}: <strong>{payload[0].value} couples</strong>
            </p>
        </div>
    );
};

export const AgeGapChart = React.memo(({ data }: { data: { range: string; count: number }[] }) => {
    if (!data.length) return (
        <section className="card demographics-card">
            <h2 className="card-title">Age Gap in Matches</h2>
            <div className="empty-state" style={{ height: 200 }}>No age gap data.</div>
        </section>
    );

    const total = data.reduce((s, d) => s + d.count, 0);
    const closest = data[0];

    return (
        <section className="card demographics-card">
            <h2 className="card-title">Age Gap in Matches</h2>
            <p style={{ fontSize: 12, color: 'rgba(239,233,224,0.5)', marginBottom: 12, marginTop: -8 }}>
                {total} couples with known ages · most common: {closest?.range}
            </p>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" />
                    <XAxis dataKey="range" tick={{ fill: '#EFE9E0', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'rgba(239,233,224,0.6)', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#C13111" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </section>
    );
});
