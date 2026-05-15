import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://stats-api-743597976254.us-central1.run.app";

async function apiFetch(path: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
    return res.json();
}

const server = new McpServer({
    name: "balloon-mcp",
    version: "1.0.0",
});

// ── Aggregate stats ─────────────────────────────────────────────────────────

server.tool(
    "get_overview",
    "Overall Pop the Balloon stats: total episodes, match rate, avg age, gender split",
    {},
    async () => {
        const data = await apiFetch("/api/stats/overview");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_outcomes",
    "Breakdown of contestant outcomes (Matched / Not Matched) split by role (Chooser / Choosee)",
    {},
    async () => {
        const data = await apiFetch("/api/stats/outcomes");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_locations",
    "Counts of contestants by location/city",
    {},
    async () => {
        const data = await apiFetch("/api/stats/locations");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_religion_breakdown",
    "Count of contestants by religion",
    {},
    async () => {
        const data = await apiFetch("/api/stats/religion");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_age_gaps",
    "Distribution of age gaps between matched couples",
    {},
    async () => {
        const data = await apiFetch("/api/stats/age-gaps");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_geo_matches",
    "Geographic match patterns — which city/region pairings produce the most matches",
    {},
    async () => {
        const data = await apiFetch("/api/stats/geo-matches");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_industries",
    "Match rates broken down by contestant industry/job sector",
    {},
    async () => {
        const data = await apiFetch("/api/stats/industries");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_dealbreakers",
    "Most common dealbreaker reasons given by contestants",
    {},
    async () => {
        const data = await apiFetch("/api/stats/dealbreakers");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_drama_scores",
    "Drama scores per episode with the most memorable moment from each",
    {},
    async () => {
        const data = await apiFetch("/api/stats/drama");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_best_episodes",
    "Episodes ranked by match rate (highest first), with drama score and video URL",
    {},
    async () => {
        const data = await apiFetch("/api/stats/best-episodes");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_kids_stats",
    "Stats on contestants' preferences or situations regarding kids",
    {},
    async () => {
        const data = await apiFetch("/api/stats/kids");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_age_match_rates",
    "Match rates broken down by contestant age",
    {},
    async () => {
        const data = await apiFetch("/api/stats/age-match");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

// ── Episodes ─────────────────────────────────────────────────────────────────

server.tool(
    "list_episodes",
    "List all Pop the Balloon episodes with number, title, match rate, drama score, and contestant count",
    {},
    async () => {
        const data = await apiFetch("/api/episodes");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_episode",
    "Get full details for a single episode including all contestants",
    { episode_number: z.number().int().positive().describe("Episode number, e.g. 92") },
    async ({ episode_number }) => {
        const data = await apiFetch(`/api/episodes/${episode_number}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

// ── Contestants ───────────────────────────────────────────────────────────────

server.tool(
    "list_contestants",
    "List all contestants across all episodes with name, age, location, job, outcome, and partner name",
    {},
    async () => {
        const data = await apiFetch("/api/contestants");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

server.tool(
    "get_contestant",
    "Get full profile for a single contestant by their URL slug (e.g. 'sarah-johnson' or 'sarah-johnson-ep-42')",
    { slug: z.string().describe("Contestant slug from list_contestants, e.g. 'sarah-johnson-ep-42'") },
    async ({ slug }) => {
        const data = await apiFetch(`/api/contestants/${slug}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
