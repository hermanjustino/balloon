import { collection, getDocs, doc, setDoc, getDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { ref, deleteObject, listAll } from "firebase/storage";
import { db, storage, handleFirestoreError } from "./firebase";
import { Metrics, MatchDataPoint, Demographics, AnalysisResult } from "../types";

/* 
  -----------------------------------------------------------------------
  STORAGE SERVICE (Repository Pattern)
  Reads are public. Writes require Auth.
  -----------------------------------------------------------------------
*/

export const StorageService = {
    getMetrics: async (): Promise<Metrics> => {
        try {
            const docRef = doc(db, "balloon_data", "metrics");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as Metrics;
            }
        } catch (error) {
            // If permission denied on metrics, likely database is fresh/unconfigured.
            handleFirestoreError(error, 'getMetrics');
        }
        // Default Fallback
        return {
            episodesAnalyzed: 0,
            overallMatchRate: '-',
            avgAge: '-',
            totalParticipants: 0,
        };
    },

    saveMetrics: async (data: Metrics) => {
        try {
            await setDoc(doc(db, "balloon_data", "metrics"), data);
        } catch (e) { handleFirestoreError(e, 'saveMetrics'); }
    },

    getMatchData: async (): Promise<MatchDataPoint[]> => {
        try {
            const docRef = doc(db, "balloon_data", "matchData");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().points as MatchDataPoint[];
            }
        } catch (e) {
            handleFirestoreError(e, 'getMatchData');
        }
        return [];
    },

    saveMatchData: async (data: MatchDataPoint[]) => {
        try {
            await setDoc(doc(db, "balloon_data", "matchData"), { points: data });
        } catch (e) { handleFirestoreError(e, 'saveMatchData'); }
    },

    getDemographics: async (): Promise<Demographics> => {
        try {
            const docRef = doc(db, "balloon_data", "demographics");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as Demographics;
            }
        } catch (e) { handleFirestoreError(e, 'getDemographics'); }
        return { male: 0, female: 0 };
    },

    saveDemographics: async (data: Demographics) => {
        try {
            await setDoc(doc(db, "balloon_data", "demographics"), data);
        } catch (e) { handleFirestoreError(e, 'saveDemographics'); }
    },

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
            console.log(`Successfully batch updated ${updates.length} records.`);
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

            console.log("All data successfully deleted from Firestore.");
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
