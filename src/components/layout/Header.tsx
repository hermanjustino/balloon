import React from 'react';

type HeaderProps = {
    viewMode: string;
    setViewMode: (mode: string) => void;
    onRequestReset: () => void;
    onBack?: () => void;
};

export const Header = ({ viewMode, setViewMode, onRequestReset, onBack }: HeaderProps) => (
    <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {onBack && (
                <button className="back-btn" onClick={onBack}>
                    &larr; Home
                </button>
            )}
            <h1>Pop the Balloon Analytics</h1>
        </div>
        <div className="header-controls">
            <button
                className={`view-toggle ${viewMode === 'public' ? 'active' : ''}`}
                onClick={() => setViewMode('public')}
            >
                Public View
            </button>
            <button
                className={`view-toggle ${viewMode === 'admin' ? 'active' : ''}`}
                onClick={() => setViewMode('admin')}
            >
                Admin
            </button>
            {viewMode === 'admin' && (
                <button className="reset-btn" onClick={onRequestReset} title="Clear all data">Clear</button>
            )}
        </div>
    </header>
);
