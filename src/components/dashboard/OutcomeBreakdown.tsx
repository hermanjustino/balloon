import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, Cell,
} from 'recharts';

interface OutcomeRow { role: string; outcome: string; count: number; }

const OUTCOME_COLORS: Record<string, string> = {
    Matched:      '#448AFF',
    Popped:       '#FF5252',
    Eliminated:   '#FFA726',
    'Walked Away': '#AB47BC',
};

const OUTCOMES_ORDER = ['Matched', 'Popped', 'Eliminated', 'Walked Away'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#3E2723', border: '1px solid #C13111',
            borderRadius: 8, padding: '10px 14px',
        }}>
            <p style={{ color: '#EFE9E0', fontWeight: 600, marginBottom: 6 }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.fill, fontSize: 13, margin: '2px 0' }}>
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
};

export const OutcomeBreakdown = React.memo(({ data }: { data: OutcomeRow[] }) => {
    if (!data.length) return (
        <section className="card table-card">
            <h2 className="card-title">Outcome Breakdown by Role</h2>
            <div className="empty-state" style={{ height: 250 }}>No outcome data.</div>
        </section>
    );

    // Pivot: [{ role, Matched, Popped, Eliminated, 'Walked Away' }, ...]
    const byRole: Record<string, Record<string, number>> = {};
    for (const row of data) {
        if (!byRole[row.role]) byRole[row.role] = {};
        byRole[row.role][row.outcome] = row.count;
    }
    const chartData = Object.entries(byRole).map(([role, outcomes]) => ({
        role, ...outcomes,
    }));

    // Role-level summary for stat pills
    const total = (role: string, outcome: string) =>
        byRole[role]?.[outcome] ?? 0;
    const roleTotal = (role: string) =>
        Object.values(byRole[role] ?? {}).reduce((s, v) => s + v, 0);
    const matchPct = (role: string) => {
        const t = roleTotal(role);
        return t ? Math.round((total(role, 'Matched') / t) * 100) : 0;
    };

    return (
        <section className="card table-card">
            <h2 className="card-title">Outcome Breakdown by Role</h2>

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {Object.keys(byRole).map(role => (
                    <div key={role} style={{ fontSize: 13, color: 'rgba(239,233,224,0.8)' }}>
                        <strong style={{ color: '#EFE9E0' }}>{role}</strong>
                        {' — '}match rate: <strong style={{ color: '#448AFF' }}>{matchPct(role)}%</strong>
                        {' · '}total: {roleTotal(role)}
                    </div>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,233,224,0.08)" />
                    <XAxis dataKey="role" tick={{ fill: '#EFE9E0', fontSize: 13 }} />
                    <YAxis tick={{ fill: 'rgba(239,233,224,0.6)', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ color: '#EFE9E0', fontSize: 13, paddingTop: 12 }}
                    />
                    {OUTCOMES_ORDER.map(outcome => (
                        <Bar key={outcome} dataKey={outcome} stackId="a" fill={OUTCOME_COLORS[outcome]} radius={outcome === 'Matched' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </section>
    );
});
