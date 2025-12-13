import React, { useMemo } from 'react';
import { AnalysisResult } from '../../types';

type LocationsChartProps = {
    history: AnalysisResult[];
};

export const LocationsChart = ({ history }: LocationsChartProps) => {
    // 1. Process Data
    const data = useMemo(() => {
        const stateMap = new Map<string, { total: number; cities: Map<string, number> }>();

        history.forEach(analysis => {
            analysis.contestants?.forEach(contestant => {
                let city = 'Unknown';
                let state = 'Unknown';

                if (typeof contestant.location === 'string') {
                    // Fallback for legacy string locations not yet migrated
                    const parts = contestant.location.split(',').map(s => s.trim());
                    city = parts[0] || 'Unknown';
                    state = parts.length > 1 ? parts[1] : 'Unknown';
                } else {
                    // New Object Structure
                    city = contestant.location.city || 'Unknown';
                    state = contestant.location.state || 'Unknown';
                }

                if (!stateMap.has(state)) {
                    stateMap.set(state, { total: 0, cities: new Map() });
                }

                const stateStats = stateMap.get(state)!;
                stateStats.total += 1;
                stateStats.cities.set(city, (stateStats.cities.get(city) || 0) + 1);
            });
        });

        // Convert to sorted array
        return Array.from(stateMap.entries())
            .map(([state, stats]) => ({
                state,
                total: stats.total,
                cities: Array.from(stats.cities.entries())
                    .map(([city, count]) => ({ city, count }))
                    .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8); // Top 8 States
    }, [history]);

    if (data.length === 0) return null;

    // Calculate max value for scaling bar widths
    const maxCount = Math.max(...data.map(d => d.total));

    // Vintage Bar Colors (cycling)
    const segmentColors = ['#8B210A', '#C13111', '#6D4C41', '#A1887F'];

    return (
        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3 className="card-title">Top Contestant Locations</h3>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                {data.map((item) => (
                    <div key={item.state} style={{ marginBottom: '1rem' }}>
                        {/* Label Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{item.state}</span>
                            <span style={{ color: 'var(--text-muted-color)' }}>{item.total} contestants</span>
                        </div>

                        {/* Stacked Bar */}
                        <div style={{
                            display: 'flex',
                            height: '24px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            background: 'rgba(0,0,0,0.05)',
                            width: '100%'
                        }}>
                            {item.cities.map((city, idx) => {
                                const widthPct = (city.count / item.total) * 100;
                                return (
                                    <div
                                        key={city.city}
                                        title={`${city.city}: ${city.count}`}
                                        style={{
                                            width: `${widthPct}%`,
                                            backgroundColor: segmentColors[idx % segmentColors.length],
                                            borderRight: '1px solid #EFE9E0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#EFE9E0',
                                            fontSize: '0.75rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {widthPct > 15 && city.city}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sub-labels for major cities */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-color)', marginTop: '2px' }}>
                            {item.cities.slice(0, 3).map(c => `${c.city} (${c.count})`).join(', ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
