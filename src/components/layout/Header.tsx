import React from 'react';

type HeaderProps = {
    viewMode: string;
    setViewMode: (mode: string) => void;
    onBack?: () => void;
};

export const Header = ({ viewMode, setViewMode, onBack }: HeaderProps) => (
    <header className="header">
        <div className="header-brand">
            {onBack && (
                <button className="back-btn" onClick={onBack}>
                    &larr; Home
                </button>
            )}
            <h1>Pop the Balloon Analytics</h1>
        </div>
        <div className="header-controls">
            <a
                href="/contestants"
                style={{ fontSize: '0.875rem', color: 'var(--text-on-card, #EFE9E0)', opacity: 0.8, textDecoration: 'none', padding: '0.4rem 0.75rem' }}
            >
                Contestants
            </a>
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
        </div>
    </header>
);
