import { AuthService } from "./auth";
import { AnalysisResult } from "../types";

/*
  -----------------------------------------------------------------------
  AI SERVICE
  Proxies Gemini calls through the backend so the API key never touches
  the browser bundle.
  -----------------------------------------------------------------------
*/

async function authHeaders(): Promise<Record<string, string>> {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return { 'Content-Type': 'application/json', 'X-Firebase-Auth': token };
}

export const AIService = {
    analyzeTranscript: async (transcript: string, episodeNumber?: string, videoUrl?: string): Promise<AnalysisResult> => {
        const headers = await authHeaders();
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers,
            body: JSON.stringify({ transcript, episodeNumber, videoUrl }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || 'Analyze request failed');
        }
        return await response.json() as AnalysisResult;
    },

    refineLocations: async (contestants: { name: string, location: string | { city: string, state: string, original: string } }[]): Promise<any[]> => {
        const headers = await authHeaders();
        const response = await fetch('/api/refine-locations', {
            method: 'POST',
            headers,
            body: JSON.stringify({ contestants }),
        });
        if (!response.ok) {
            console.error('refineLocations request failed:', response.statusText);
            return contestants;
        }
        return response.json();
    },
};
