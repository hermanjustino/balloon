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
import { calculateStats } from './utils/stats';
import './styles/index.css';

// --- Main App Logic (Controller) ---
const getAdminEmail = () => {
    try {
        return import.meta.env.VITE_ADMIN_EMAIL || "hejustino@hjdconsulting.ca";
    } catch (e) {
        return "hejustino@hjdconsulting.ca";
    }
};
const ADMIN_EMAIL = getAdminEmail();

const App = () => {
    const [showLanding, setShowLanding] = useState(true);
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
    const [matchData, setMatchData] = useState<MatchDataPoint[]>([]);
    const [demographics, setDemographics] = useState<Demographics>({ male: 0, female: 0 });
    const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>([]);

    // Auth Listener
    useEffect(() => {
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

    // Load Data on Mount (Async for Firestore)
    useEffect(() => {
        async function loadData() {
            try {
                const [m, matches, demo, history] = await Promise.all([
                    StorageService.getMetrics(),
                    StorageService.getMatchData(),
                    StorageService.getDemographics(),
                    StorageService.getHistory()
                ]);

                setMetrics(m);
                setMatchData(matches);
                setDemographics(demo);
                setRecentAnalyses(history);
            } catch (e: any) {
                // Detect if this is a permission error (rules not set up)
                if (e.name === 'FirebasePermissionError') {
                    setSetupError(true);
                }
            } finally {
                setIsLoadingData(false);
            }
        }
        loadData();
    }, []);



    const handleDeleteEpisode = async (id: string, hasTranscript: boolean) => {
        if (!confirm("Are you sure you want to delete this episode record?")) return;

        try {
            await StorageService.deleteAnalysis(id, hasTranscript);

            // Update local state by removing the deleted item
            const updatedHistory = recentAnalyses.filter(item => item.id !== id);

            // Recalculate global stats based on remaining items
            const { metrics: newMetrics, demographics: newDemographics, matchData: newMatchData } = calculateStats(updatedHistory);

            // Save recalculated stats to backend
            await Promise.all([
                StorageService.saveMatchData(newMatchData),
                StorageService.saveDemographics(newDemographics),
                StorageService.saveMetrics(newMetrics)
            ]);

            // Update UI
            setRecentAnalyses(updatedHistory);
            setMetrics(newMetrics);
            setDemographics(newDemographics);
            setMatchData(newMatchData);

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

            // --- 1. Calculate New State ---

            // History
            const newHistory = [result, ...recentAnalyses];

            // Match Data
            const displayTitle = result.episodeNumber
                ? `Ep ${result.episodeNumber}: ${result.episodeTitle}`
                : result.episodeTitle;
            const newMatchData = [{ name: displayTitle, rate: result.matchRate }, ...matchData];

            // Demographics
            let newDemographics = demographics;
            const totalParticipants = (metrics.totalParticipants || 0) + result.participantCount;
            if (totalParticipants > 0) {
                const prevCount = metrics.totalParticipants || 0;
                const newMale = ((demographics.male * prevCount) + (result.malePercentage * result.participantCount)) / totalParticipants;
                const newFemale = ((demographics.female * prevCount) + (result.femalePercentage * result.participantCount)) / totalParticipants;
                newDemographics = { male: Math.round(newMale), female: Math.round(newFemale) };
            }

            // Metrics
            const episodes = (metrics.episodesAnalyzed || 0) + 1;
            const prevAvgAge = typeof metrics.avgAge === 'number' ? metrics.avgAge : 0;
            const newAvgAge = prevAvgAge === 0
                ? result.avgAge
                : ((prevAvgAge * (metrics.totalParticipants || 0)) + (result.avgAge * result.participantCount)) / totalParticipants;

            const prevMatchRate = typeof metrics.overallMatchRate === 'number' ? metrics.overallMatchRate : 0;
            const newMatchRate = prevMatchRate === 0
                ? result.matchRate
                : ((prevMatchRate * (episodes - 1)) + result.matchRate) / episodes;

            const newMetrics = {
                episodesAnalyzed: episodes,
                overallMatchRate: newMatchRate,
                avgAge: newAvgAge,
                totalParticipants: totalParticipants
            };

            // --- 2. Save to Firestore (Explicitly) ---
            // We do this BEFORE updating state to ensure persistence works
            await Promise.all([
                StorageService.addAnalysis(result),
                StorageService.saveMatchData(newMatchData),
                StorageService.saveDemographics(newDemographics),
                StorageService.saveMetrics(newMetrics)
            ]);

            // --- 3. Update UI ---
            setRecentAnalyses(newHistory);
            setMatchData(newMatchData);
            setDemographics(newDemographics);
            setMetrics(newMetrics);

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

    const isAuthorized = user && user.email === ADMIN_EMAIL;

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
                <KeyMetrics metrics={metrics} />
                <div className="dashboard-grid">
                    <DemographicsChart demographics={demographics} />
                    <LocationsChart history={recentAnalyses} />
                    <AnalysisTable
                        recentAnalyses={recentAnalyses}
                        onSelectEpisode={setSelectedEpisode}
                        isAdmin={!!(isAuthorized && viewMode === 'admin')}
                        onDelete={handleDeleteEpisode}
                    />
                </div>
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
