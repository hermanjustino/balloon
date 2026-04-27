import React from 'react';
import { ContestantsMap } from './ContestantsMap';

interface LandingPageProps {
    onEnterDashboard: () => void;
    stateData?: Record<string, number>;
}

const BalloonSVG: React.FC = () => (
    <svg
        viewBox="0 0 120 190"
        className="balloon-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <ellipse cx="60" cy="73" rx="52" ry="60" fill="#C13111" />
        <path d="M50 128 Q55 148 60 153 Q65 148 70 128" fill="#C13111" />
        <ellipse cx="38" cy="47" rx="14" ry="20" fill="rgba(255,255,255,0.22)" transform="rotate(-20 38 47)" />
        <ellipse cx="74" cy="44" rx="6" ry="9" fill="rgba(255,255,255,0.10)" transform="rotate(-15 74 44)" />
        <circle cx="60" cy="156" r="5.5" fill="#8B210A" />
        <path d="M60 162 C50 172 70 180 60 188" stroke="#6D4C41" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
);

const TOPICS = [
    {
        label: 'Location',
        description: 'Does where you\'re from affect your chances? See which cities and states produce the most matches.',
    },
    {
        label: 'Occupation',
        description: 'Nurses, teachers, entrepreneurs — which professions show up most, and who actually gets matched?',
    },
    {
        label: 'Age',
        description: 'How big is the typical age gap between matched couples, and does age predict who gets popped first?',
    },
    {
        label: 'Demographics',
        description: 'A breakdown of who participates — gender, background, and how the lineup composition shifts by season.',
    },
    {
        label: 'Outcomes',
        description: 'Match, pop, or walk away. What percentage of each role ends the episode with a connection?',
    },
    {
        label: 'Drama Score',
        description: 'Some episodes are calm, others are chaos. We score each one by how much tension shows up in the transcript.',
    },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterDashboard, stateData = {} }) => {
    const scrollToExplore = (e: React.MouseEvent) => {
        e.preventDefault();
        document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="landing-page">
            <nav className="landing-nav">
                <div className="nav-brand">LuvLytics</div>
                <div className="nav-links">
                    <a href="#explore" className="nav-link" onClick={scrollToExplore}>
                        About
                    </a>
                    <a href="/contestants" className="nav-link">
                        Contestants
                    </a>
                    <button className="nav-cta" onClick={onEnterDashboard}>
                        All Trends
                    </button>
                </div>
            </nav>

            <section className="landing-hero">
                <h1 className="hero-title">
                    Dating Trends,<br />
                    <em>Decoded</em>
                </h1>
                <div className="balloon-container">
                    <BalloonSVG />
                </div>
                <p className="hero-subtitle">
                    Ever watched an episode and wondered if your read on the room was actually right?
                    We track every outcome so you can see how the numbers compare to what the contestants claim.
                </p>
            </section>

            {Object.keys(stateData).length > 0 && (
                <ContestantsMap stateData={stateData} />
            )}

            <section className="topics-intro" id="explore">
                <div className="topics-intro-inner">
                    <p className="section-eyebrow">What We Track</p>
                    <h2 className="topics-heading">
                        The questions fans actually ask
                    </h2>
                    <p className="topics-subtext">
                        Browse the data by what matters to you — where contestants come from,
                        what they do for work, how ages line up, and more.
                    </p>
                </div>

                <div className="topics-grid">
                    {TOPICS.map(topic => (
                        <button
                            key={topic.label}
                            className="topic-card"
                            onClick={onEnterDashboard}
                        >
                            <span className="topic-label">{topic.label}</span>
                            <span className="topic-desc">{topic.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <footer className="landing-footer">
                <p>Built by <a href="https://hjdconsulting.ca" target="_blank" rel="noopener noreferrer">HJ Data Consulting</a></p>
            </footer>
        </div>
    );
};
