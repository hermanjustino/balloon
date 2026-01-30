import { collection, getDocs, doc, setDoc, getDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { ref, deleteObject, listAll } from "firebase/storage";
import { db, storage, handleFirestoreError } from "./firebase";
import { Metrics, MatchDataPoint, Demographics, AnalysisResult } from "../types";
import { AuthService } from "./auth";

/* 
  -----------------------------------------------------------------------
  STORAGE SERVICE (Repository Pattern)
  Reads are public. Writes require Auth.
  -----------------------------------------------------------------------
*/

const STATS_API_URL = "/api/stats";

export const StorageService = {
    getStats: async (forceUser?: any): Promise<{ metrics: Metrics, demographics: Demographics }> => {
        try {
            const user = forceUser || AuthService.getCurrentUser();

            const headers: Record<string, string> = {};
            if (user) {
                const token = await user.getIdToken();
                headers['X-Firebase-Auth'] = token;
                console.log("📊 Storage: Fetching metrics with auth...");
            } else {
                console.log("📊 Storage: Fetching public metrics...");
            }

            const response = await fetch(`${STATS_API_URL}/overview`, { headers });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const metrics = await response.json();

            return {
                metrics: {
                    episodesAnalyzed: metrics.episodesAnalyzed,
                    overallMatchRate: metrics.overallMatchRate,
                    avgAge: metrics.avgAge,
                    totalParticipants: metrics.totalParticipants
                },
                demographics: {
                    male: metrics.malePercentage,
                    female: metrics.femalePercentage
                }
            };
        } catch (error) {
            console.error('getStats failed:', error);
            // Return defaults on error
            return {
                metrics: { episodesAnalyzed: 0, overallMatchRate: '-', avgAge: '-', totalParticipants: 0 },
                demographics: { male: 0, female: 0 }
            };
        }
    },

    getLocations: async (forceUser?: any): Promise<{ location: string, count: number }[]> => {
        try {
            const user = forceUser || AuthService.getCurrentUser();

            const headers: Record<string, string> = {};
            if (user) {
                const token = await user.getIdToken();
                headers['X-Firebase-Auth'] = token;
            }

            const response = await fetch(`${STATS_API_URL}/locations`, { headers });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('getLocations failed:', error);
            return [];
        }
    },

    getMetrics: async (): Promise<Metrics> => {
        // Deprecated: Use getStats instead
        const res = await StorageService.getStats();
        return res.metrics;
    },

    // demographics and matchData are now powered by BigQuery via getStats()

    getHistory: async (): Promise<AnalysisResult[]> => {
        try {
            const q = query(collection(db, "analyses"), orderBy("dateAnalyzed", "desc"));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as AnalysisResult));
        } catch (e) {
            handleFirestoreError(e, 'getHistory');
            return [];
        }
    },

    addAnalysis: async (data: AnalysisResult) => {
        try {
            // Use setDoc with a specific ID to ensure consistency between analyses and transcripts
            await setDoc(doc(db, "analyses", data.id), data);
        } catch (e) { handleFirestoreError(e, 'addAnalysis'); }
    },

    // Consolidates saving to all 3 collections with "Clear-then-Upsert"
    fullySaveAnalysis: async (result: AnalysisResult) => {
        try {
            await Promise.all([
                StorageService.addAnalysis(result),
                StorageService.saveContestants(result.contestants || [], result.id, result.episodeNumber, result.episodeTitle),
                StorageService.saveCouples(result.couples || [], result.id, result.episodeNumber, result.episodeTitle)
            ]);
        } catch (e) {
            console.error("fullySaveAnalysis failed:", e);
            throw e;
        }
    },

    batchUpdateAnalyses: async (updates: AnalysisResult[]) => {
        try {
            // Firestore batches are limited to 500 ops. We'll do them in chunks.
            const chunkSize = 400;
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize);
                const batchPromises = chunk.map(data =>
                    setDoc(doc(db, "analyses", data.id), data, { merge: true })
                );
                await Promise.all(batchPromises);
            }
        } catch (e) {
            handleFirestoreError(e, 'batchUpdateAnalyses');
            throw e;
        }
    },

    deleteAnalysis: async (id: string, hasTranscript: boolean) => {
        try {
            // 1. Delete Analysis Metadata
            await deleteDoc(doc(db, "analyses", id));

            // 2. Delete Transcript (Stored in Firestore 'transcripts' collection now)
            if (hasTranscript) {
                try {
                    await deleteDoc(doc(db, "transcripts", id));
                } catch (e) {
                    console.warn("Could not delete transcript doc (might not exist or permission denied):", e);
                }
            }
        } catch (e) {
            handleFirestoreError(e, 'deleteAnalysis');
        }
    },

    // Securely fetch transcript on demand from Firestore
    loadTranscript: async (episode: AnalysisResult): Promise<string> => {
        // 1. Check Legacy: Direct String in analysis object
        if (episode.transcript) return episode.transcript;

        // 2. Fetch from 'transcripts' collection in Firestore
        // We use the same ID for the analysis document and the transcript document
        if (episode.hasTranscript && episode.id) {
            try {
                const docRef = doc(db, "transcripts", episode.id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return docSnap.data().content || "Transcript content is empty.";
                } else {
                    return "Transcript not found in database.";
                }
            } catch (e) {
                console.warn("Permission denied or file missing:", e);
                return "Access Denied: You do not have permission to view this transcript (Admin only).";
            }
        }

        return "No transcript available for this episode.";
    },

    clearAll: async () => {
        try {
            // 1. Delete singleton documents in 'balloon_data'
            await Promise.all([
                deleteDoc(doc(db, "balloon_data", "metrics")),
                deleteDoc(doc(db, "balloon_data", "matchData")),
                deleteDoc(doc(db, "balloon_data", "demographics"))
            ]);

            // 2. Delete all documents in 'analyses' collection
            const qAnalyses = query(collection(db, "analyses"));
            const snapshotAnalyses = await getDocs(qAnalyses);
            const deleteAnalysesPromises = snapshotAnalyses.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteAnalysesPromises);

            // 3. Delete all documents in 'transcripts' collection
            try {
                const qTranscripts = query(collection(db, "transcripts"));
                const snapshotTranscripts = await getDocs(qTranscripts);
                const deleteTranscriptsPromises = snapshotTranscripts.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deleteTranscriptsPromises);
            } catch (transcriptError) {
                console.warn("Transcript deletion warning (might be empty or permission issue):", transcriptError);
            }

            // 4. (Optional) Attempt to clean legacy storage files, just in case
            try {
                const listRef = ref(storage, 'transcripts/');
                const listRes = await listAll(listRef);
                await Promise.all(listRes.items.map((itemRef) => deleteObject(itemRef)));
            } catch (storageError) {
                console.warn("Storage cleanup warning (ignorable if not using storage):", storageError);
            }
        } catch (e) {
            handleFirestoreError(e, 'clearAll');
            throw e; // Re-throw so the UI knows it failed
        }
    },

    // NEW: Save contestants to normalized collection
    saveContestants: async (contestants: any[], episodeId: string, episodeNumber?: string, episodeTitle?: string) => {
        try {
            const writes = contestants.map(contestant =>
                setDoc(doc(db, "contestants", contestant.id), {
                    ...contestant,
                    episodeId,
                    episodeNumber: episodeNumber || null,
                    episodeTitle: episodeTitle || "",
                    analyzedAt: new Date().toISOString()
                })
            );
            await Promise.all(writes);
        } catch (e) {
            handleFirestoreError(e, 'saveContestants');
        }
    },

    // NEW: Save couples to normalized collection  
    saveCouples: async (couples: any[], episodeId: string, episodeNumber?: string, episodeTitle?: string) => {
        try {
            const writes = couples.map(couple =>
                setDoc(doc(db, "couples", crypto.randomUUID()), {
                    episodeId,
                    episodeNumber: episodeNumber || null,
                    episodeTitle: episodeTitle || "",
                    contestant1Id: couple.contestant1Id,
                    contestant2Id: couple.contestant2Id,
                    person1Name: couple.person1,  // Denormalized for easy display
                    person2Name: couple.person2,
                    matchedAt: new Date().toISOString()
                })
            );
            await Promise.all(writes);
        } catch (e) {
            handleFirestoreError(e, 'saveCouples');
        }
    },
};
