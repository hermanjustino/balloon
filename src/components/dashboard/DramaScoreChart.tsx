import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

interface DramaRow {
    episodeNumber: string;
    episodeTitle: string;
    dramaScore: number | null;
    memorableMoment: string;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as DramaRow;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '10px 14px', maxWidth: 280,
        }}>
            <p style={{ color: '#EFE9E0', fontWeight: 600, marginBottom: 4 }}>
                Ep {d.episodeNumber}: {d.episodeTitle}
            </p>
            <p style={{ color: '#FFA726', fontSize: 13, marginBottom: 6 }}>
                Drama score: {d.dramaScore}/10
            </p>
            {d.memorableMoment && (
                <p style={{ color: 'rgba(239,233,224,0.7)', fontSize: 12, lineHeight: 1.4 }}>
                    "{d.memorableMoment}"
                </p>
            )}
        </div>
    );
};

// Score → colour: low = cool blue, high = hot red
const scoreColor = (score: number) => {
    const t = (score - 1) / 9; // 0→1
    const r = Math.round(68  + t * (255 - 68));
    const g = Math.round(138 + t * (82  - 138));
    const b = Math.round(255 + t * (82  - 255));
    return `rgb(${r},${g},${b})`;
};

export const DramaScoreChart = React.memo(({ data }: { data: DramaRow[] }) => {
    const [selected, setSelected] = useState<DramaRow | null>(null);

    if (!data.length) return (
        <section className="card table-card">
            <h2 className="card-title">Episode Drama Scores</h2>
            <div className="empty-state" style={{ height: 200 }}>No drama scores yet — backfill pending.</div>
        </section>
    );

    const sorted = [...data].sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));

    return (
        <section className="card table-card">
            <h2 className="card-title">Episode Drama Scores</h2>
            <p style={{ fontSize: 12, color: 'rgba(239,233,224,0.5)', marginBottom: 16, marginTop: -8 }}>
                {data.length} episodes rated · click a bar to see the memorable moment
            </p>

            <ResponsiveContainer width="100%" height={200}>
                <BarChart
                    data={sorted}
                    margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    onClick={(e) => e?.activePayload && setSelected(e.activePayload[0]?.payload)}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" />
                    <XAxis
                        dataKey="episodeNumber"
                        tick={{ fill: 'rgba(239,233,224,0.5)', fontSize: 10 }}
                        label={{ value: 'Episode', position: 'insideBottom', offset: -2, fill: 'rgba(239,233,224,0.4)', fontSize: 11 }}
                    />
                    <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: 'rgba(239,233,224,0.5)', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="dramaScore" radius={[3, 3, 0, 0]} cursor="pointer">
                        {sorted.map((entry, i) => (
                            <Cell key={i} fill={scoreColor(entry.dramaScore ?? 5)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {selected && (
                <div style={{
                    marginTop: 16, padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                    border: '1px solid rgba(239,233,224,0.1)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontWeight: 600, color: '#EFE9E0', marginBottom: 4 }}>
                                Ep {selected.episodeNumber}: {selected.episodeTitle}
                            </p>
                            <p style={{ fontSize: 13, color: 'rgba(239,233,224,0.7)', lineHeight: 1.5 }}>
                                {selected.memorableMoment || 'No memorable moment recorded.'}
                            </p>
                        </div>
                        <div style={{
                            fontSize: '2rem', fontWeight: 700,
                            color: scoreColor(selected.dramaScore ?? 5),
                            marginLeft: 16, flexShrink: 0,
                        }}>
                            {selected.dramaScore}/10
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
});
