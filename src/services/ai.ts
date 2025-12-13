import { GoogleGenAI, Type, Schema } from "@google/genai";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { AnalysisResult } from "../types";

/* 
  -----------------------------------------------------------------------
  AI SERVICE
  Handles Gemini API interaction.
  -----------------------------------------------------------------------
*/

export const AIService = {
    analyzeTranscript: async (transcript: string, episodeNumber?: string, videoUrl?: string): Promise<AnalysisResult> => {
        // API KEY MUST be import.meta.env.VITE_API_KEY. 
        // If you are developing locally, ensure your environment is set up.
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

        // 1. Generate ID early for ID consistency across collections
        const id = crypto.randomUUID();

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                episodeTitle: { type: Type.STRING, description: "A short catchy title for this episode." },
                matchRate: { type: Type.NUMBER, description: "Percentage of couples who matched (0-100)" },
                participantCount: { type: Type.NUMBER, description: "Total number of participants" },
                malePercentage: { type: Type.NUMBER, description: "Percentage of male participants (0-100)" },
                femalePercentage: { type: Type.NUMBER, description: "Percentage of female participants (0-100)" },
                matchesCount: { type: Type.NUMBER, description: "Number of matches formed" },
                sentiment: { type: Type.STRING, description: "Overall sentiment: Positive, Negative, Mixed, or Neutral" },
                avgAge: { type: Type.NUMBER, description: "Average estimated age" },
                couples: {
                    type: Type.ARRAY,
                    description: "List of couples who successfully matched at the end.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            person1: { type: Type.STRING, description: "Name of the person from the Lineup" },
                            person2: { type: Type.STRING, description: "Name of the Contestant they matched with" }
                        },
                        required: ["person1", "person2"]
                    }
                },
                contestants: {
                    type: Type.ARRAY,
                    description: "List of every person mentioned. CRITICAL: Distinguish between 'Lineup' (balloon holders) and 'Contestant' (person entering).",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Name of the person" },
                            age: { type: Type.STRING, description: "Age (e.g. '24', 'Unknown')" },
                            location: {
                                type: Type.OBJECT,
                                description: "Split location into components. Use standard 2-letter state codes (e.g. TX, CA, NY).",
                                properties: {
                                    city: { type: Type.STRING, description: "City name" },
                                    state: { type: Type.STRING, description: "State/Province code (e.g. TX, CA)" },
                                    country: { type: Type.STRING, description: "Country code (default US)" },
                                    original: { type: Type.STRING, description: "The original raw location string from the transcript" }
                                },
                                required: ["city", "state", "original"]
                            },
                            job: { type: Type.STRING, description: "Job title" },
                            role: { type: Type.STRING, description: "MUST be either 'Lineup' (holding balloon) or 'Contestant' (walking in to find match)." },
                            outcome: { type: Type.STRING, description: "Short result: 'Matched', 'Popped', 'Eliminated', 'Walked Away'" }
                        },
                        required: ["name", "age", "location", "role", "outcome"]
                    }
                }
            },
            required: ["episodeTitle", "matchRate", "participantCount", "malePercentage", "femalePercentage", "matchesCount", "sentiment", "avgAge", "couples", "contestants"]
        };

        const epContext = episodeNumber ? `This is Episode ${episodeNumber}.` : "";

        // 2. Perform AI Analysis
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following transcript from the dating show "Pop the Balloon". ${epContext}
      
      FORMAT RULES:
      - The show has a "Lineup" of people holding balloons.
      - "Contestants" come out one by one to face the Lineup.
      - You MUST classify every person as either "Lineup" or "Contestant".
      - You MUST extract the specific names of couples that matched.
      
      Extract statistics and the full list of people.
      
      TRANSCRIPT:
      ${transcript}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });

        const result = JSON.parse(response.text);

        // 3. Upload Transcript to Firestore 'transcripts' collection
        // This avoids CORS issues associated with 'uploadString' to Cloud Storage
        // We now include metadata (Episode Title, Number) to easily associate the transcript in the DB console.
        try {
            await setDoc(doc(db, "transcripts", id), {
                content: transcript,
                episodeTitle: result.episodeTitle,
                episodeNumber: episodeNumber || "N/A",
                videoUrl: videoUrl || "",
                analysisId: id,
                createdAt: new Date().toISOString()
            });
        } catch (uploadError) {
            console.error("Failed to save transcript to Firestore:", uploadError);
            // We do not throw here to allow the analysis to be saved even if the full text backup fails.
        }

        // 4. Return combined result
        return {
            ...result,
            id: id,
            dateAnalyzed: new Date().toISOString().split('T')[0],
            episodeNumber: episodeNumber,
            videoUrl: videoUrl,
            hasTranscript: true // Flag to tell UI to fetch from 'transcripts' collection
        };
    },

    // NEW: Migration Helper
    refineLocations: async (contestants: { name: string, location: string | { city: string, state: string, original: string } }[]): Promise<any[]> => {
        // Filter only those that are strings
        const legacyItems = contestants.filter(c => typeof c.location === 'string');
        if (legacyItems.length === 0) return contestants;

        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

        // Define simple schema for just location parsing
        const locationSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    original: { type: Type.STRING, description: "The original location string provided" },
                    city: { type: Type.STRING },
                    state: { type: Type.STRING, description: "2-letter state code (e.g. TX)" },
                    country: { type: Type.STRING, description: "Country code (default US)" }
                },
                required: ["original", "city", "state"]
            }
        };

        const prompt = `Parse these location strings into City and State objects.
        
        LOCATIONS TO PARSE:
        ${JSON.stringify(legacyItems.map(c => c.location))}
        `;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: locationSchema
                }
            });

            const parsedLocations = JSON.parse(response.text) as any[];

            // Merge back into original array
            return contestants.map(c => {
                if (typeof c.location !== 'string') return c;

                const match = parsedLocations.find(p => p.original === c.location);
                if (match) {
                    return {
                        ...c,
                        location: {
                            city: match.city,
                            state: match.state,
                            country: match.country || 'US',
                            original: c.location as string
                        }
                    };
                }
                return c; // Fallback if AI missed one
            });

        } catch (e) {
            console.error("Migration failed for batch:", e);
            return contestants; // Fail safe, return original
        }
    }
};
