import { AnalysisResult } from "../types";

// Helper to recalculate stats from a list of analyses
export const calculateStats = (analyses: AnalysisResult[]) => {
    let totalEpisodes = analyses.length;
    let totalParticipants = 0;

    // We iterate to calculate aggregates
    let totalMatchRateSum = 0;
    let weightedAgeSum = 0;
    let totalMale = 0;
    let totalFemale = 0;

    analyses.forEach(a => {
        totalParticipants += a.participantCount;
        totalMatchRateSum += a.matchRate;
        weightedAgeSum += (a.avgAge * a.participantCount);

        // Approx demographic counts from percentages
        totalMale += (a.malePercentage * a.participantCount) / 100;
        totalFemale += (a.femalePercentage * a.participantCount) / 100;
    });

    const avgMatchRate = totalEpisodes > 0 ? totalMatchRateSum / totalEpisodes : 0;
    const globalAvgAge = totalParticipants > 0 ? weightedAgeSum / totalParticipants : 0;

    // Normalize demographics to percentages
    const totalDemographicCount = totalMale + totalFemale;
    const malePct = totalDemographicCount > 0 ? (totalMale / totalDemographicCount) * 100 : 0;
    const femalePct = totalDemographicCount > 0 ? (totalFemale / totalDemographicCount) * 100 : 0;

    return {
        metrics: {
            episodesAnalyzed: totalEpisodes,
            overallMatchRate: avgMatchRate,
            avgAge: globalAvgAge,
            totalParticipants: totalParticipants
        },
        demographics: {
            male: Math.round(malePct),
            female: Math.round(femalePct)
        },
        matchData: analyses.map(a => ({
            name: a.episodeNumber ? `Ep ${a.episodeNumber}: ${a.episodeTitle}` : a.episodeTitle,
            rate: a.matchRate
        }))
    };
};
