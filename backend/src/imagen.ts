import * as fs from 'fs';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID  = process.env.PROJECT_ID || 'balloon-87473';
const LOCATION    = 'us-central1';
const MODEL       = 'imagen-3.0-generate-002';
const ENDPOINT    = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvatarOptions {
    name:         string;
    gender?:      string;
    age?:         string;
    job?:         string;
    // Vision traits — optional; Imagen falls back to neutral descriptors when absent
    hairColor?:   string;
    hairStyle?:   string;
    fashionStyle?: string;
    heightRange?: string;
    bodyType?:    string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(opts: AvatarOptions): string {
    const genderWord = opts.gender?.toLowerCase() === 'male' ? 'man' : 'woman';
    const agePart    = opts.age && opts.age !== 'Unknown' ? `${opts.age}-year-old ` : '';
    const hairPart   = opts.hairColor && opts.hairStyle
        ? `${opts.hairColor} ${opts.hairStyle.toLowerCase()} hair. `
        : '';
    const stylePart  = opts.fashionStyle ? `${opts.fashionStyle} style outfit. ` : '';
    const buildPart  = opts.bodyType     ? `${opts.bodyType} build. `             : '';

    return (
        `Digital illustration portrait of a ${agePart}${genderWord}. ` +
        hairPart + stylePart + buildPart +
        `Vibrant, stylized trading card illustration art. ` +
        `Centered composition, waist-up portrait, clean gradient background. ` +
        `Sharp details, professional quality, bold colors.`
    ).trim();
}

// ---------------------------------------------------------------------------
// Imagen 3 generation via Vertex AI REST API
// ---------------------------------------------------------------------------

export async function generateAvatar(opts: AvatarOptions, outputPath: string): Promise<string> {
    const auth  = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const token = await auth.getAccessToken();

    const prompt = buildPrompt(opts);
    console.log(`[IMAGEN] Generating avatar for ${opts.name}`);
    console.log(`[IMAGEN] Prompt: "${prompt}"`);

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
                sampleCount:  1,
                aspectRatio:  '1:1',
                outputOptions: { mimeType: 'image/png' },
                safetySetting: 'block_some',
            },
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Imagen API ${response.status}: ${body}`);
    }

    const data = await response.json() as any;
    const b64   = data.predictions?.[0]?.bytesBase64Encoded as string | undefined;

    if (!b64) throw new Error('Imagen returned no image data');

    fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
    console.log(`[IMAGEN] Saved: ${outputPath}`);
    return outputPath;
}
