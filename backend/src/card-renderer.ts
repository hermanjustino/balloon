import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { VisionTraits } from './vision';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardData {
    name:          string;
    age:           string;
    job:           string;
    city:          string;
    state:         string;
    gender?:       string;
    outcome:       string;
    matchedWith?:  string;
    popReason?:    string;
    hasKids?:      boolean;
    kidsCount?:    number;
    episodeNumber: string;
    episodeTitle?: string;
    avatarPath?:   string; // Imagen-generated PNG (preferred)
    framePath?:    string; // raw video frame (fallback)
    vision?:       VisionTraits;
}

// ---------------------------------------------------------------------------
// Outcome styling
// ---------------------------------------------------------------------------

const OUTCOME_STYLE: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    Matched:       { bg: '#1B4332', text: '#52B788', border: '#52B788', icon: '✓' },
    Popped:        { bg: '#3B0F0F', text: '#EF5350', border: '#EF5350', icon: '💥' },
    Eliminated:    { bg: '#1C2526', text: '#78909C', border: '#78909C', icon: '✗' },
    'Walked Away': { bg: '#2D2007', text: '#FFA726', border: '#FFA726', icon: '🚶' },
};

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function buildHTML(card: CardData): string {
    const style = OUTCOME_STYLE[card.outcome] ?? OUTCOME_STYLE['Eliminated'];

    // Embed image as base64 so Puppeteer doesn't need to fetch external URLs
    let imgTag = '';
    const avatarExists = card.avatarPath && fs.existsSync(card.avatarPath);
    const frameExists  = card.framePath  && fs.existsSync(card.framePath);

    if (avatarExists) {
        const b64 = fs.readFileSync(card.avatarPath!).toString('base64');
        imgTag = `<img class="portrait-img" src="data:image/png;base64,${b64}" />`;
    } else if (frameExists) {
        const b64 = fs.readFileSync(card.framePath!).toString('base64');
        imgTag = `<img class="portrait-img" src="data:image/jpeg;base64,${b64}" />`;
    } else {
        const emoji = card.gender?.toLowerCase() === 'male' ? '👨' : '👩';
        imgTag = `<div class="portrait-placeholder">${emoji}</div>`;
    }

    const kidsText = card.hasKids === true
        ? `Yes${card.kidsCount ? ` (${card.kidsCount})` : ''}`
        : card.hasKids === false ? 'No' : '—';

    const location = [card.city, card.state].filter(Boolean).join(', ') || '—';

    const matchedWithRow = card.matchedWith ? `
        <div class="stat-row full-width">
          <span class="stat-icon">❤️</span>
          <div class="stat-body">
            <div class="stat-label">Matched With</div>
            <div class="stat-val accent">${card.matchedWith}</div>
          </div>
        </div>` : '';

    const visionStats = card.vision ? `
        <div class="stat-row">
          <span class="stat-icon">💇</span>
          <div class="stat-body">
            <div class="stat-label">Hair</div>
            <div class="stat-val accent">${card.vision.hairColor} · ${card.vision.hairStyle}</div>
          </div>
        </div>
        <div class="stat-row">
          <span class="stat-icon">👗</span>
          <div class="stat-body">
            <div class="stat-label">Style</div>
            <div class="stat-val accent">${card.vision.fashionStyle}</div>
          </div>
        </div>` : '';

    const popReasonBlock = card.outcome === 'Popped' && card.popReason ? `
        <div class="pop-reason">
          <span class="pop-label">Popped for:</span> ${card.popReason}
        </div>` : '';

    const rarityText = card.outcome === 'Matched' ? '★★★ MATCHED' : '★ SERIES 1';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }

body {
  width: 350px; height: 490px;
  background: transparent;
  font-family: Arial, Helvetica, sans-serif;
}

.card {
  width: 350px; height: 490px;
  background: linear-gradient(160deg, #1E0B02 0%, #2D1008 45%, #1A0A00 100%);
  border: 2px solid #C13111;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 24px rgba(193,49,17,0.35), inset 0 0 50px rgba(0,0,0,0.6);
}

/* subtle inner foil effect */
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    transparent 0%, rgba(255,167,38,0.04) 35%,
    transparent 50%, rgba(193,49,17,0.06) 75%,
    transparent 100%);
  border-radius: 14px;
  pointer-events: none;
  z-index: 20;
}

/* ── Header ── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px 7px;
  background: linear-gradient(180deg, rgba(193,49,17,0.28) 0%, transparent 100%);
  border-bottom: 1px solid rgba(193,49,17,0.35);
}
.show-title {
  font-size: 9px; font-weight: 800;
  letter-spacing: 2px; text-transform: uppercase;
  color: #FFA726;
}
.ep-badge {
  font-size: 9px; font-weight: 700;
  letter-spacing: 1px;
  color: rgba(239,233,224,0.55);
}

/* ── Portrait ── */
.portrait-wrap {
  position: relative;
  width: 100%; height: 190px;
  background: #0D0502;
  overflow: hidden;
}
.portrait-img {
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: top center;
}
.portrait-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle, #2D1008 0%, #0D0502 100%);
  font-size: 64px;
}
.portrait-fade {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 64px;
  background: linear-gradient(transparent, #1E0B02);
}

/* ── Name block ── */
.name-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 9px 14px 5px;
}
.name {
  font-size: 18px; font-weight: 900;
  color: #EFE9E0; letter-spacing: 0.4px; line-height: 1.1;
  text-shadow: 0 0 12px rgba(193,49,17,0.5);
}
.age-text {
  font-size: 11.5px;
  color: rgba(239,233,224,0.45);
  margin-top: 2px;
}
.outcome-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid ${style.border};
  background: ${style.bg};
  color: ${style.text};
  font-size: 9.5px; font-weight: 800;
  letter-spacing: 1px; text-transform: uppercase;
  white-space: nowrap;
  margin-top: 1px;
}

/* ── Divider ── */
.divider {
  height: 1px; margin: 0 14px;
  background: linear-gradient(90deg, transparent, rgba(193,49,17,0.45), transparent);
}

/* ── Stats ── */
.stats {
  padding: 9px 14px 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 10px;
}
.stat-row {
  display: flex; align-items: flex-start; gap: 5px;
}
.stat-icon {
  font-size: 11px; width: 16px; flex-shrink: 0; margin-top: 1px;
}
.stat-body { flex: 1; min-width: 0; }
.stat-label {
  font-size: 7px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.8px;
  color: rgba(239,233,224,0.38); line-height: 1;
}
.stat-val {
  font-size: 10.5px; font-weight: 600;
  color: #EFE9E0; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.stat-val.accent { color: #FFA726; }
.stat-row.full-width { grid-column: span 2; }

/* ── Pop reason ── */
.pop-reason {
  margin: 2px 14px 6px;
  padding: 5px 10px;
  background: rgba(239,83,80,0.1);
  border: 1px solid rgba(239,83,80,0.28);
  border-radius: 6px;
  font-size: 9px;
  color: rgba(239,233,224,0.65);
  font-style: italic;
  line-height: 1.35;
}
.pop-label { color: #EF5350; font-weight: 700; font-style: normal; }

/* ── Footer ── */
.footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 6px 14px;
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid rgba(193,49,17,0.28);
  background: rgba(0,0,0,0.35);
}
.footer-url {
  font-size: 6.5px;
  color: rgba(239,233,224,0.2);
  letter-spacing: 0.4px;
}
.rarity {
  font-size: 7.5px; font-weight: 700;
  color: #FFA726; letter-spacing: 1px;
}
</style>
</head>
<body>
<div class="card">

  <div class="header">
    <div class="show-title">🎈 Pop the Balloon</div>
    <div class="ep-badge">EP. ${card.episodeNumber}</div>
  </div>

  <div class="portrait-wrap">
    ${imgTag}
    <div class="portrait-fade"></div>
  </div>

  <div class="name-row">
    <div>
      <div class="name">${card.name}</div>
      ${card.age && card.age !== 'Unknown' ? `<div class="age-text">Age ${card.age}</div>` : ''}
    </div>
    <div class="outcome-badge">${style.icon} ${card.outcome}</div>
  </div>

  <div class="divider"></div>

  <div class="stats">
    <div class="stat-row">
      <span class="stat-icon">💼</span>
      <div class="stat-body">
        <div class="stat-label">Job</div>
        <div class="stat-val">${card.job || '—'}</div>
      </div>
    </div>
    <div class="stat-row">
      <span class="stat-icon">📍</span>
      <div class="stat-body">
        <div class="stat-label">Location</div>
        <div class="stat-val">${location}</div>
      </div>
    </div>
    <div class="stat-row">
      <span class="stat-icon">👶</span>
      <div class="stat-body">
        <div class="stat-label">Kids</div>
        <div class="stat-val">${kidsText}</div>
      </div>
    </div>
    ${matchedWithRow}
    ${visionStats}
  </div>

  ${popReasonBlock}

  <div class="footer">
    <div class="footer-url">balloon.hjdconsulting.ca</div>
    <div class="rarity">${rarityText}</div>
  </div>

</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Renderer: HTML → PNG via Puppeteer
// ---------------------------------------------------------------------------

export async function renderCard(card: CardData, outputPath: string): Promise<string> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        // 3× device scale = 1050×1470 output (print-quality)
        await page.setViewport({ width: 350, height: 490, deviceScaleFactor: 3 });
        await page.setContent(buildHTML(card), { waitUntil: 'networkidle0' });
        await page.screenshot({
            path: outputPath as `${string}.png`,
            clip: { x: 0, y: 0, width: 350, height: 490 },
            omitBackground: false,
        });
        console.log(`[CARD] Rendered → ${outputPath}`);
        return outputPath;
    } finally {
        await browser.close();
    }
}
