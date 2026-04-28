import React, { useState } from 'react';

type HeaderProps = {
    viewMode: string;
    setViewMode: (mode: string) => void;
    onBack?: () => void;
};

export const Header = ({ viewMode, setViewMode, onBack }: HeaderProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const close = () => setMenuOpen(false);

    return (
        <header className="header">
            <div className="header-brand">
                {onBack && (
                    <button className="back-btn" onClick={onBack}>
                        &larr; Home
                    </button>
                )}
                <h1>Pop the Balloon Analytics</h1>
                <button
                    className={`burger-btn${menuOpen ? ' burger-btn--open' : ''}`}
                    onClick={() => setMenuOpen(o => !o)}
                    aria-label="Toggle navigation"
                    aria-expanded={menuOpen}
                >
                    <span className="burger-bar" />
                    <span className="burger-bar" />
                    <span className="burger-bar" />
                </button>
            </div>
            <div className={`header-controls${menuOpen ? ' header-controls--open' : ''}`}>
                <a href="/episodes" className="header-nav-link" onClick={close}>Episodes</a>
                <a href="/contestants" className="header-nav-link" onClick={close}>Contestants</a>
                <button
                    className={`view-toggle ${viewMode === 'public' ? 'active' : ''}`}
                    onClick={() => { setViewMode('public'); close(); }}
                >
                    Public View
                </button>
                <button
                    className={`view-toggle ${viewMode === 'admin' ? 'active' : ''}`}
                    onClick={() => { setViewMode('admin'); close(); }}
                >
                    Admin
                </button>
            </div>
        </header>
    );
};
