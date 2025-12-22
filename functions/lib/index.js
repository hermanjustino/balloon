"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// import { BigQuery } from "@google-cloud/bigquery";
admin.initializeApp();
// const bigquery = new BigQuery();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hejustino@hjdconsulting.ca";
/**
 * Stats API: Serves pre-computed metrics from BigQuery.
 * This is the "OLAP" endpoint for the UI.
 */
exports.getStats = (0, https_1.onCall)({
    cors: true,
    maxInstances: 10,
}, async (request) => {
    // 1. Authorization Check (v2 style)
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (request.auth.token.email !== ADMIN_EMAIL) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized access: Admin only.");
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
    }
    catch (error) {
        console.error("Test failed:", error);
        throw new https_1.HttpsError("internal", "Test failed.");
    }
});
//# sourceMappingURL=index.js.map