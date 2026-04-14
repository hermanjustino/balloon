import React, { useState, useEffect } from 'react';
import { StorageService, AIService, AuthService } from './services';
import { AnalysisResult, Metrics, Demographics, MatchDataPoint } from './types';
import { User } from 'firebase/auth';
import { KeyMetrics } from './components/dashboard/KeyMetrics';
import { DemographicsChart } from './components/dashboard/DemographicsChart';
import { AnalysisTable } from './components/dashboard/AnalysisTable';
import { SetupGuide } from './components/modals/SetupGuide';
import { EpisodeDetailsModal } from './components/modals/EpisodeDetailsModal';
import { Header } from './components/layout/Header';
import { LocationsChart } from './components/dashboard/LocationsChart';
import { LoginForm } from './components/admin/LoginForm';
import { AdminPanel } from './components/admin/AdminPanel';
import { LandingPage } from './components/landing/LandingPage';
import { ContestantSearch } from './components/pages/ContestantSearch';
import { OutcomeBreakdown } from './components/dashboard/OutcomeBreakdown';
import { KidsStats } from './components/dashboard/KidsStats';
import { ReligionChart } from './components/dashboard/ReligionChart';
import { AgeGapChart } from './components/dashboard/AgeGapChart';
import { GeoMatchCard } from './components/dashboard/GeoMatchCard';
import { BestEpisodesTable } from './components/dashboard/BestEpisodesTable';
import { IndustriesChart } from './components/dashboard/IndustriesChart';
import { DealbreakersChart } from './components/dashboard/DealbreakersChart';
import { DramaScoreChart } from './components/dashboard/DramaScoreChart';
import './styles/index.css';

// --- Main App Logic (Controller) ---
const getAdminEmail = () => {
    try {
        return import.meta.env.VITE_ADMIN_EMAIL;
    } catch (e) {
        return undefined;
    }
};
const ADMIN_EMAIL = getAdminEmail();

const App = () => {
    const [showLanding, setShowLanding] = useState(true);
    const [currentPage, setCurrentPage] = useState<'dashboard' | 'search'>('dashboard');
    const [viewMode, setViewMode] = useState('public');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisInput, setAnalysisInput] = useState({ videoUrl: '', transcript: '', episodeNumber: '' });
    const [selectedEpisode, setSelectedEpisode] = useState<AnalysisResult | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [setupError, setSetupError] = useState(false);

    // Auth State
    const [user, setUser] = useState<User | null>(null);

    // Initialize Data State
    const [metrics, setMetrics] = useState<Metrics>({ episodesAnalyzed: 0, overallMatchRate: '-', avgAge: '-', totalParticipants: 0 });
    const [demographics, setDemographics] = useState<Demographics>({ male: 0, female: 0 });
    const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>([]);
    const [locationData, setLocationData] = useState<{ location: string, count: number }[]>([]);

    // New analytics state
    const [outcomeData, setOutcomeData] = useState<{ role: string; outcome: string; count: number }[]>([]);
    const [kidsData, setKidsData] = useState<any>(null);
    const [religionData, setReligionData] = useState<{ religion: string; count: number }[]>([]);
    const [ageGapData, setAgeGapData] = useState<{ range: string; count: number }[]>([]);
    const [geoData, setGeoData] = useState<any>(null);
    const [bestEpisodesData, setBestEpisodesData] = useState<any[]>([]);
    const [industriesData, setIndustriesData] = useState<any[]>([]);
    const [dealbreakersData, setDealbreakersData] = useState<any[]>([]);
    const [dramaData, setDramaData] = useState<any[]>([]);

    // Auth Listener
    useEffect(() => {
        // --- DEV ONLY: Expose services for testing ---
        if (import.meta.env.DEV) {
            (window as any).StorageService = StorageService;
            console.log("🛠️ Dev Mode: StorageService exposed as window.StorageService");
        }

        const unsubscribe = AuthService.onAuthStateChanged((currentUser) => {
            if (currentUser && currentUser.email !== ADMIN_EMAIL) {
                // Enforce "Only I can sign in" - Kick out unauthorized users immediately
                AuthService.logout();
                alert("Access Denied: You are not authorized to access the Admin Console.");
                setUser(null);
            } else {
                setUser(currentUser);
            }
        });
        return () => unsubscribe();
    }, []);

    const refreshStats = async (currentUser?: User | null) => {
        const activeUser = currentUser || user;
        console.log("♻️ App: Refreshing dashboard data (Auth Status:", !!activeUser, ")");

        // 1. Fetch BigQuery Stats (OLAP) - Decoupled
        try {
            const [statsRes, locations, outcomes, kids, religion, ageGaps, geo, bestEps, industries, dealbreakers, drama] = await Promise.all([
                StorageService.getStats(activeUser),
                StorageService.getLocations(activeUser),
                StorageService.getOutcomes(),
                StorageService.getKidsStats(),
                StorageService.getReligion(),
                StorageService.getAgeGaps(),
                StorageService.getGeoMatches(),
                StorageService.getBestEpisodes(),
                StorageService.getIndustries(),
                StorageService.getDealbreakers(),
                StorageService.getDramaScores(),
            ]);
            console.log("✅ App: BigQuery stats received", { metrics: !!statsRes.metrics.episodesAnalyzed });
            setMetrics(statsRes.metrics);
            setDemographics(statsRes.demographics);
            setLocationData(locations);
            setOutcomeData(outcomes);
            setKidsData(kids);
            setReligionData(religion);
            setAgeGapData(ageGaps);
            setGeoData(geo);
            setBestEpisodesData(bestEps);
            setIndustriesData(industries);
            setDealbreakersData(dealbreakers);
            setDramaData(drama);
        } catch (e) {
            console.error("❌ App: BigQuery fetch failed:", e);
        }

        // 2. Fetch Firestore History (OLTP) - Decoupled
        try {
            const history = await StorageService.getHistory();
            console.log("✅ App: Firestore history received", { count: history.length });
            setRecentAnalyses(history);
        } catch (e: any) {
            console.error("❌ App: Firestore fetch failed:", e);
            if (e.name === 'FirebasePermissionError') {
                setSetupError(true);
            }
        }
    };

    // Load Data on Mount and Auth state change
    useEffect(() => {
        async function loadData() {
            await refreshStats(user);
            setIsLoadingData(false);
        }
        loadData();
    }, [user]);



    const handleDeleteEpisode = async (id: string, hasTranscript: boolean) => {
        if (!confirm("Are you sure you want to delete this episode record?")) return;

        try {
            await StorageService.deleteAnalysis(id, hasTranscript);

            // Refresh everything (OLTP history is instant, OLAP metrics follow export schedule)
            await refreshStats();

        } catch (e: any) {
            console.error("Failed to delete episode:", e);
            if (e.name === 'FirebasePermissionError') {
                alert("Permission Denied: Your Firestore rules are blocking deletion. Please check the Setup Guide code in your modal for the updated rules.");
                setSetupError(true); // Trigger the setup guide to show
            } else {
                alert("Error deleting episode. Check console.");
            }
        }
    };

    const handleGoogleLogin = async () => {
        // We just call the service here; errors are handled by the LoginForm component for better UI feedback
        return await AuthService.loginWithGoogle();
    };

    const handleAnalyze = async (e: any) => {
        e.preventDefault();
        if (!analysisInput.transcript) return alert("Please paste the transcript to analyze.");

        setIsAnalyzing(true);

        try {
            const result = await AIService.analyzeTranscript(
                analysisInput.transcript,
                analysisInput.episodeNumber,
                analysisInput.videoUrl
            );

            // --- 2. Save to Firestore (OLTP) ---
            await StorageService.fullySaveAnalysis(result);

            // --- 3. Update UI ---
            // OLTP History updates immediately
            await refreshStats();

            setAnalysisInput({ videoUrl: '', transcript: '', episodeNumber: '' });

        } catch (error) {
            console.error("Analysis failed:", error);
            alert("Failed to analyze transcript. Check console for details.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Show landing page first
    if (showLanding) {
        return <LandingPage onEnterDashboard={() => setShowLanding(false)} />;
    }

    // Show Contestant Search page (Admin only)
    const isAuthorized = user && user.email === ADMIN_EMAIL;
    if (currentPage === 'search') {
        if (!isAuthorized) {
            setCurrentPage('dashboard');
            return null;
        }
        return <ContestantSearch history={recentAnalyses} onBack={() => setCurrentPage('dashboard')} />;
    }

    if (isLoadingData) {
        return <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '5rem' }}>Loading data...</div>
    }

    // If initial load failed due to permissions, show the setup guide immediately
    if (setupError) {
        return (
            <div className="container">
                <Header viewMode={viewMode} setViewMode={setViewMode} onBack={() => setShowLanding(true)} />
                <SetupGuide />
            </div>
        );
    }

    // isAuthorized is already defined above

    return (
        <div className="container">
            <Header viewMode={viewMode} setViewMode={setViewMode} onBack={() => setShowLanding(true)} />

            <main>
                {viewMode === 'admin' && (
                    <>
                        {!user ? (
                            <LoginForm onLogin={AuthService.login} onGoogleLogin={handleGoogleLogin} />
                        ) : !isAuthorized ? (
                            // This block handles the split second before the auth listener logs them out
                            <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Verifying access...</div>
                        ) : (
                            <AdminPanel
                                analysisInput={analysisInput}
                                setAnalysisInput={setAnalysisInput}
                                handleAnalyze={handleAnalyze}
                                isAnalyzing={isAnalyzing}
                                user={user}
                                login={AuthService.login}
                                logout={AuthService.logout}
                            />
                        )}
                    </>
                )}
                <section className="key-metrics-grid" aria-label="Key Metrics">
                    <KeyMetrics metrics={metrics} />
                    <KidsStats data={kidsData} />
                </section>

                <div className="dashboard-grid">
                    <DemographicsChart demographics={demographics} />
                    <div className="demographics-card">
                        <LocationsChart history={recentAnalyses} />
                    </div>
                    <AnalysisTable
                        recentAnalyses={recentAnalyses}
                        onSelectEpisode={setSelectedEpisode}
                        isAdmin={!!(isAuthorized && viewMode === 'admin')}
                        onDelete={handleDeleteEpisode}
                    />
                </div>

                {/* ── Analytics Section ── */}
                <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
                    <OutcomeBreakdown data={outcomeData} />
                    <ReligionChart data={religionData} />
                    <AgeGapChart data={ageGapData} />
                    <GeoMatchCard data={geoData} />
                    <BestEpisodesTable data={bestEpisodesData} />
                    <IndustriesChart data={industriesData} />
                    <DealbreakersChart data={dealbreakersData} />
                    <DramaScoreChart data={dramaData} />
                </div>

                {/* Navigation to Search Page (Admin only) */}
                {isAuthorized && viewMode === 'admin' && (
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <button className="analyze-btn" onClick={() => setCurrentPage('search')}>
                            🔍 Search All Contestants
                        </button>
                    </div>
                )}
            </main>

            {selectedEpisode && (
                <EpisodeDetailsModal
                    episode={selectedEpisode}
                    onClose={() => setSelectedEpisode(null)}
                    isAdmin={!!user} // Pass auth status to modal
                />
            )}


        </div>
    );
};

export default App;
