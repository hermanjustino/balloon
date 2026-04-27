type LocationLike = { city?: string; state?: string; country?: string } | string;
type JobHolder = { jobs?: string[]; job?: string };

export function formatLocation(loc: LocationLike): string {
    if (typeof loc === 'object' && loc !== null) {
        return [loc.city, loc.state].filter(Boolean).join(', ');
    }
    return (loc as string) || '';
}

export function primaryJob(c: JobHolder): string {
    if (c.jobs && c.jobs.length > 0) return c.jobs[0];
    return c.job || '';
}

export function outcomeColor(outcome?: string): string {
    if (outcome === 'Matched') return '#2d6a4f';
    if (outcome === 'Walked Away') return '#6b6b6b';
    return '#C13111';
}
