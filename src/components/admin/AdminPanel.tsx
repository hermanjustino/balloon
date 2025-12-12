import React from 'react';
import { User } from 'firebase/auth';

export const AdminPanel = ({
    analysisInput,
    setAnalysisInput,
    handleAnalyze,
    isAnalyzing,
    user,
    login,
    logout
}: {
    analysisInput: any,
    setAnalysisInput: any,
    handleAnalyze: any,
    isAnalyzing: boolean,
    user: User,
    login: any,
    logout: any
}) => {
    return (
        <section className="card input-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem' }}>New Analysis</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted-color)' }}>{user?.email}</span>
                    <button onClick={logout} className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>Logout</button>
                </div>
            </div>

            <form onSubmit={handleAnalyze}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-field" style={{ flex: '0 0 100px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Episode #</label>
                        <input
                            type="text"
                            placeholder="#"
                            value={analysisInput.episodeNumber}
                            onChange={(e) => setAnalysisInput({ ...analysisInput, episodeNumber: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-color)' }}
                        />
                    </div>
                    <div className="form-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>YouTube URL (Optional - for reference)</label>
                        <input
                            type="url"
                            placeholder="https://youtube.com/..."
                            value={analysisInput.videoUrl}
                            onChange={(e) => setAnalysisInput({ ...analysisInput, videoUrl: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-color)' }}
                        />
                    </div>
                </div>

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Transcript</label>
                    <textarea
                        rows={8}
                        placeholder="Paste the full transcript here..."
                        value={analysisInput.transcript}
                        onChange={(e) => setAnalysisInput({ ...analysisInput, transcript: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-color)', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                </div>

                <button type="submit" className="analyze-btn" disabled={isAnalyzing} style={{ width: '100%', padding: '1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: isAnalyzing ? 0.7 : 1 }}>
                    {isAnalyzing ? (
                        <>
                            <div className="spinner"></div>
                            Analyzing with Gemini Pro...
                        </>
                    ) : (
                        <>🚀 Analyze Episode</>
                    )}
                </button>
            </form>
        </section>
    );
};
