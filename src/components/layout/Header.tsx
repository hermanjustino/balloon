import React from 'react';

type HeaderProps = {
    viewMode: string;
    setViewMode: (mode: string) => void;
    onRequestReset: () => void;
};

export const Header = ({ viewMode, setViewMode, onRequestReset }: HeaderProps) => (
    <header className="header">
        <h1><span>🎈</span> Pop the Balloon Analytics</h1>
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
                <button className="reset-btn" onClick={onRequestReset} title="Clear all data">🗑️</button>
            )}
        </div>
    </header>
);
