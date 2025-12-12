import React from 'react';
import { Demographics } from '../../types';

export const DemographicsChart = React.memo(({ demographics }: { demographics: Demographics }) => (
    <section className="card demographics-card">
        <h2 className="card-title">Participant Demographics</h2>
        {demographics && demographics.male === 0 && demographics.female === 0 ? (
            <div className="empty-state" style={{ height: '250px' }}>No demographic data.</div>
        ) : (
            <div className="pie-chart-container" style={{ '--male-pct': `${demographics?.male || 0}%` } as React.CSSProperties}>
                <div className="pie-chart" role="img" aria-label={`Pie chart: ${demographics?.male || 0}% Male`}></div>
                <div className="pie-legend">
                    <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: 'var(--bg-color)' }}></span>
                        <span>Male ({demographics?.male || 0}%)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: 'var(--secondary-color)' }}></span>
                        <span>Female ({demographics?.female || 0}%)</span>
                    </div>
                </div>
            </div>
        )}
    </section>
));
