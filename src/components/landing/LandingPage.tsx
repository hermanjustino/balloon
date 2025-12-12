import React from 'react';

interface LandingPageProps {
    onEnterDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterDashboard }) => {
    return (
        <div className="landing-page">
            <nav className="landing-nav">
                <div className="nav-brand">LuvLytics</div>
                <a href="mailto:hejustino@hjdconsulting.ca" className="nav-link">Contact</a>
            </nav>

            <main className="landing-hero">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Data-Driven Insights for
                        <span className="highlight"> Reality Dating Shows</span>
                    </h1>
                    <p className="hero-subtitle">
                        AI-powered analysis of contestant behavior, match predictions, and demographic trends.
                        Transforming entertainment into actionable insights.
                    </p>

                    <div className="hero-cta">
                        <button className="cta-primary" onClick={onEnterDashboard}>
                            View Pop the Balloon Data
                        </button>
                    </div>
                </div>

                <div className="hero-stats">
                    <div className="stat-item">
                        <span className="stat-value">AI</span>
                        <span className="stat-label">Powered Analysis</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">Real-Time</span>
                        <span className="stat-label">Data Updates</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">Public</span>
                        <span className="stat-label">Access</span>
                    </div>
                </div>
            </main>

            <section className="landing-features">
                <h2 className="section-heading">What We Analyze</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">M</div>
                        <h3>Match Rates</h3>
                        <p>Track which episodes produce the most successful connections and identify patterns in compatibility.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">D</div>
                        <h3>Demographics</h3>
                        <p>Understand the age, gender, and profession breakdown of contestants across all episodes.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">S</div>
                        <h3>Sentiment</h3>
                        <p>AI-driven sentiment analysis of conversations and interactions during each episode.</p>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <p>Built by <a href="https://hjdconsulting.ca" target="_blank" rel="noopener noreferrer">HJ Data Consulting</a></p>
            </footer>
        </div>
    );
};
