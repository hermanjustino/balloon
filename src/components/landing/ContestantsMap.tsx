import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const STATE_CENTROIDS: Record<string, [number, number]> = {
    AL: [-86.79, 32.78], AK: [-152.40, 64.20], AZ: [-111.09, 34.05],
    AR: [-92.37, 34.86], CA: [-119.42, 36.78], CO: [-105.55, 39.11],
    CT: [-72.68, 41.60], DE: [-75.50, 38.91], FL: [-81.52, 27.77],
    GA: [-83.44, 32.69], HI: [-157.50, 21.10], ID: [-114.74, 44.07],
    IL: [-89.20, 40.35], IN: [-86.13, 39.85], IA: [-93.21, 42.01],
    KS: [-98.38, 38.53], KY: [-84.27, 37.67], LA: [-91.83, 31.17],
    ME: [-69.38, 44.69], MD: [-76.80, 38.98], MA: [-71.53, 42.24],
    MI: [-84.54, 43.33], MN: [-94.63, 46.07], MS: [-89.40, 32.74],
    MO: [-92.29, 37.96], MT: [-110.45, 46.88], NE: [-99.90, 41.49],
    NV: [-117.07, 38.50], NH: [-71.57, 43.45], NJ: [-74.52, 40.06],
    NM: [-106.25, 34.52], NY: [-74.95, 43.30], NC: [-79.38, 35.63],
    ND: [-101.35, 47.53], OH: [-82.79, 40.39], OK: [-97.53, 35.57],
    OR: [-120.55, 43.94], PA: [-77.27, 40.59], RI: [-71.47, 41.68],
    SC: [-80.95, 33.86], SD: [-99.90, 44.44], TN: [-86.69, 35.86],
    TX: [-99.34, 31.47], UT: [-111.09, 39.32], VT: [-72.71, 44.05],
    VA: [-78.66, 37.43], WA: [-120.74, 47.75], WV: [-80.95, 38.64],
    WI: [-89.62, 43.78], WY: [-107.55, 43.00], DC: [-77.03, 38.91],
};

const STATE_NAME_TO_ABBR: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

export function normalizeStateToAbbr(raw: string): string | null {
    const s = raw.trim();
    const upper = s.toUpperCase();
    if (STATE_CENTROIDS[upper]) return upper;
    return STATE_NAME_TO_ABBR[s] ?? null;
}

interface Props {
    stateData: Record<string, number>;
}

type Tooltip = { x: number; y: number; state: string; count: number };

export const ContestantsMap: React.FC<Props> = ({ stateData }) => {
    const [tooltip, setTooltip] = useState<Tooltip | null>(null);

    const entries = Object.entries(stateData).filter(([s]) => STATE_CENTROIDS[s]) as [string, number][];
    const maxCount = Math.max(...entries.map(([, c]) => c as number), 1);

    if (entries.length === 0) return null;

    const bubbleRadius = (count: number) => 5 + (count / maxCount) * 26;

    return (
        <section className="map-section">
            <div className="map-inner">
                <p className="section-eyebrow">Where They Come From</p>
                <h2 className="map-heading">Contestants Across America</h2>
                <div className="map-wrapper">
                    <ComposableMap
                        projection="geoAlbersUsa"
                        projectionConfig={{ scale: 900 }}
                        style={{ width: '100%', height: 'auto' }}
                    >
                        <Geographies geography={GEO_URL}>
                            {({ geographies }) =>
                                geographies.map(geo => (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill="#D4C9B8"
                                        stroke="#C0B09E"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: 'none' },
                                            hover:   { fill: '#C6B7A6', outline: 'none' },
                                            pressed: { outline: 'none' },
                                        }}
                                    />
                                ))
                            }
                        </Geographies>

                        {entries.map(([state, count]) => {
                            const r = bubbleRadius(count);
                            return (
                                <Marker key={state} coordinates={STATE_CENTROIDS[state]}>
                                    <circle
                                        r={r}
                                        fill="rgba(193, 49, 17, 0.72)"
                                        stroke="#8B210A"
                                        strokeWidth={1}
                                        style={{ cursor: 'pointer' }}
                                        onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY, state, count })}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                    {r >= 14 && (
                                        <text
                                            textAnchor="middle"
                                            dy=".35em"
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                fontSize: 9,
                                                fontWeight: 700,
                                                fill: '#EFE9E0',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            {count}
                                        </text>
                                    )}
                                </Marker>
                            );
                        })}
                    </ComposableMap>

                    {tooltip && ReactDOM.createPortal(
                        <div
                            className="map-tooltip"
                            style={{ top: tooltip.y - 58, left: tooltip.x }}
                        >
                            <strong>{tooltip.state}</strong>
                            <span>{tooltip.count} contestant{tooltip.count !== 1 ? 's' : ''}</span>
                        </div>,
                        document.body
                    )}
                </div>
                <p className="map-caption">
                    All analyzed episodes · bubble size reflects contestant count per state
                </p>
            </div>
        </section>
    );
};
