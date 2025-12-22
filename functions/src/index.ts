import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
// import { BigQuery } from "@google-cloud/bigquery";

admin.initializeApp();
// const bigquery = new BigQuery();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hejustino@hjdconsulting.ca";

/**
 * Stats API: Serves pre-computed metrics from BigQuery.
 * This is the "OLAP" endpoint for the UI.
 */
export const getStats = onCall({
    cors: true,
    maxInstances: 10,
}, async (request) => {
    // 1. Authorization Check (v2 style)
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    if (request.auth.token.email !== ADMIN_EMAIL) {
        throw new HttpsError(
            "permission-denied",
            "Unauthorized access: Admin only."
        );
    }

    try {
        // MOCK DATA for environment testing
        return {
            metrics: {
                episodesAnalyzed: 1,
                overallMatchRate: 50,
                avgAge: 25,
                totalParticipants: 10
            },
            demographics: { male: 50, female: 50 },
            matchData: [],
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error("Test failed:", error);
        throw new HttpsError(
            "internal",
            "Test failed."
        );
    }
});
