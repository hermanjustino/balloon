import React from 'react';
import { MatchDataPoint } from '../../types';

export const MatchChart = React.memo(({ matchData, hoveredBar, setHoveredBar }: { matchData: MatchDataPoint[], hoveredBar: any, setHoveredBar: any }) => (
    <section className="card chart-card">
        <h2 className="card-title">Match Rate per Episode</h2>
        {matchData && matchData.length > 0 ? (
            <div className="bar-chart" aria-label="Bar chart showing match rates">
                {matchData.map((show, index) => (
                    <div
                        className="bar-wrapper"
                        key={`${show.name}-${index}`}
                        onMouseEnter={() => setHoveredBar(show)}
                        onMouseLeave={() => setHoveredBar(null)}
                    >
                        <div className="bar" style={{ height: `${show.rate}%` }} title={`${show.name}: ${show.rate}%`}>
                            {hoveredBar === show && <div className="tooltip">{show.rate}%</div>}
                        </div>
                        <div className="bar-label">{show.name}</div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="empty-state">No data yet.</div>
        )}
    </section>
));
