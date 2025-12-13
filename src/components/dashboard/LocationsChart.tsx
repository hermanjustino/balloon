import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { AnalysisResult } from '../../types';

type LocationsChartProps = {
    history: AnalysisResult[];
};

export const LocationsChart = ({ history }: LocationsChartProps) => {
    // 1. Process Data
    const data = useMemo(() => {
        const stateMap = new Map<string, { total: number; cities: Map<string, { count: number; contestants: any[] }> }>();

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

                // Filter out Unknown states as requested
                if (state === 'Unknown' || state === 'XX') return;

                if (!stateMap.has(state)) {
                    stateMap.set(state, { total: 0, cities: new Map() });
                }

                const stateStats = stateMap.get(state)!;
                stateStats.total += 1;

                if (!stateStats.cities.has(city)) {
                    stateStats.cities.set(city, { count: 0, contestants: [] });
                }
                const cityEntry = stateStats.cities.get(city)!;
                cityEntry.count += 1;
                cityEntry.contestants.push(contestant);
            });
        });

        // Convert to sorted array
        return Array.from(stateMap.entries())
            .map(([state, stats]) => ({
                state,
                total: stats.total,
                cities: Array.from(stats.cities.entries())
                    .map(([city, data]) => ({
                        city,
                        count: data.count,
                        contestants: data.contestants
                    }))
                    .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8); // Top 8 States
    }, [history]);

    if (data.length === 0) return null;

    // Vintage Bar Colors (cycling)
    const segmentColors = ['#8B210A', '#C13111', '#6D4C41', '#A1887F'];

    // Custom Tooltip State
    const [hoveredCity, setHoveredCity] = React.useState<{ city: string, count: number, x: number, y: number } | null>(null);
    const [selectedCityData, setSelectedCityData] = React.useState<{ city: string, contestants: any[] } | null>(null);

    const handleMouseMove = (e: React.MouseEvent, city: string, count: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredCity({
            city,
            count,
            x: e.clientX,       // Follow Cursor X
            y: rect.top         // Anchor to Top of Bar Y
        });
    };

    // Calculate max value for scaling bar widths to be proportional
    const maxCount = Math.max(...data.map(d => d.total));

    return (
        <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <h3 className="card-title">Top Contestant Locations</h3>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                {data.map((item) => (
                    <div key={item.state} style={{ marginBottom: '1.5rem' }}>
                        {/* Label Row */}
                        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px', borderBottom: '1px solid #C13111', paddingBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-color)', marginRight: 'auto' }}>{item.state}</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 500 }}>{item.total} total</span>
                        </div>

                        {/* Stacked "Treemap" Bar */}
                        <div style={{
                            display: 'flex',
                            height: '60px',
                            width: `${(item.total / maxCount) * 100}%`,
                            minWidth: '10px',
                            boxShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                            transition: 'width 0.5s ease-out'
                        }}>
                            {item.cities.map((city, idx) => {
                                const widthPct = (city.count / item.total) * 100;
                                return (
                                    <div
                                        key={city.city}
                                        onMouseMove={(e) => handleMouseMove(e, city.city, city.count)}
                                        onMouseLeave={() => setHoveredCity(null)}
                                        onClick={() => setSelectedCityData({ city: city.city, contestants: city.contestants })}
                                        style={{
                                            width: `${widthPct}%`,
                                            backgroundColor: segmentColors[idx % segmentColors.length],
                                            borderRight: '1px solid #EFE9E0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            justifyContent: 'center',
                                            color: '#EFE9E0',
                                            fontSize: '0.85rem',
                                            padding: '0 8px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'opacity 0.2s',
                                        }}
                                        className="treemap-bar-segment"
                                    >
                                        {(widthPct > 10 && ((item.total / maxCount) * 100 * (widthPct / 100)) > 5) && (
                                            <>
                                                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{city.city}</span>
                                                {widthPct > 20 && <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>{city.count}</span>}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Custom Floating Tooltip - Rendered via Portal to escape Card's stacking context */}
            {hoveredCity && !selectedCityData && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed',
                    top: hoveredCity.y - 12,
                    left: hoveredCity.x,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: '#3E2723',
                    color: '#EFE9E0',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    pointerEvents: 'none',
                    zIndex: 9999, // High Z-Index
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    border: '1px solid #C13111',
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                }}>
                    {hoveredCity.city}: {hoveredCity.count}
                    <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '6px solid #C13111'
                    }}></div>
                </div>,
                document.body
            )}

            {/* City Details Modal - Rendered via Portal for Full Viewport */}
            {selectedCityData && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setSelectedCityData(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedCityData.city}</h2>
                                <div style={{ color: 'var(--text-muted-color)' }}>
                                    {selectedCityData.contestants.length} Contestants found from this location.
                                </div>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedCityData(null)}>&times;</button>
                        </div>

                        <div className="contestant-grid">
                            {selectedCityData.contestants.map((c, idx) => (
                                <div className="contestant-card" key={idx} style={{ padding: '1rem' }}>
                                    <div className="c-name" style={{ fontSize: '1rem' }}>{c.name}</div>
                                    <div className="c-meta" style={{ fontSize: '0.8rem' }}>
                                        <span>{c.age !== 'Unknown' ? `${c.age} y/o` : 'Age N/A'}</span>
                                    </div>
                                    {c.job && <div className="c-job" style={{ fontSize: '0.85rem' }}>{c.job}</div>}
                                    <div className={`c-outcome ${c.outcome?.toLowerCase().includes('match') ? 'outcome-matched' : 'outcome-popped'}`} style={{ fontSize: '0.7rem' }}>
                                        {c.outcome || 'Unknown'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
