export interface Couple {
  person1: string;  // Legacy: Name for display
  person2: string;  // Legacy: Name for display
  contestant1Id?: string;  // NEW: Reference to contestant.id for SQL joins
  contestant2Id?: string;  // NEW: Reference to contestant.id for SQL joins
}

export interface Contestant {
  id?: string;  // NEW: Unique ID (generated during analysis)
  name: string;
  age: string;
  location: {
    city: string;
    state: string;
    country?: string;
    original: string; // Fallback/Legacy
  } | string; // Allow string for backward compatibility
  job?: string; // Deprecated: single job (legacy support)
  jobs?: string[]; // NEW: Array of jobs if multiple mentioned
  kids?: {
    hasKids: boolean;
    count: number;
    ages: (number | string)[];
  };
  religion?: string; // NEW: e.g. "Christian", "Spiritual"
  role?: string; // 'Lineup' or 'Contestant'
  outcome?: string; // e.g. "Matched", "Popped", "Walked Away"
}

export interface Demographics {
  male: number;
  female: number;
}

export interface Metrics {
  episodesAnalyzed: number;
  overallMatchRate: number | string;
  avgAge: number | string;
  totalParticipants: number;
}

export interface AnalysisResult {
  id: string; // unique ID (uuid or firebase ID)
  episodeTitle: string;
  episodeNumber?: string;
  dateAnalyzed: string;
  matchRate: number;
  participantCount: number;
  malePercentage: number;
  femalePercentage: number;
  matchesCount: number;
  sentiment: string;
  avgAge: number;
  hasTranscript?: boolean; // New flag for secure storage
  transcriptUrl?: string; // Legacy URL to Cloud Storage file
  transcript?: string; // Legacy support for older records
  videoUrl?: string; // URL to the YouTube video
  contestants?: Contestant[]; // List of extracted contestants
  couples?: Couple[]; // List of matched pairs
}

export interface MatchDataPoint {
  name: string;
  rate: number;
}