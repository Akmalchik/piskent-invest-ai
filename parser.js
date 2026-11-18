/* eslint @typescript-eslint/no-require-imports: off -- Standalone Playwright CommonJS scraper. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { assessInvestmentCandidate } = require('./lib/investmentEligibility.cjs');

const TARGET_FILE = path.join(__dirname, 'data', 'auction-candidates.json');
const BASE_URL = 'https://e-auksion.uz';
const MAX_PAGES = 11;

// Candidate discovery only. No artificial polygons, area, jobs, price or utility values.
// Database and existing manually verified records are NEVER written by this script.
async function scrapePiskentAuctionCandidates() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (compatible; PiskentInvestAI/1.0; data-review)'
    });

    const candidates = new Map();
    try {
        for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
            const url = `${BASE_URL}/lots?group=6&index=1&page=${currentPage}&address=&lt=0&at=0&order=0&q=&hashtag=&region=2&area=23`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            const cards = await page.locator('.lot-view').count();
            if (cards === 0) break;

            const entries = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.lot-view')).map(card => {
                    const anchor = card.closest('a') || card.querySelector('a[href*="lot-view"]');
                    const href = anchor?.href || '';
                    const number = card.querySelector('.ea-lot-number')?.textContent?.trim() || '';
                    const name = card.querySelector('.lot-name')?.textContent?.trim() || '';
                    const img = card.querySelector('.q-img__image');
                    const background = img ? getComputedStyle(img).backgroundImage : '';
                    const image = background && background !== 'none'
                        ? background.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
                        : null;
                    return { href, number, name, image };
                });
            });

            for (const item of entries) {
                let parsed;
                try { parsed = new URL(item.href); } catch { continue; }
                if (parsed.protocol !== 'https:' || parsed.hostname !== 'e-auksion.uz') continue;
                const idText = parsed.searchParams.get('lot_id');
                if (!idText || !/^\d+$/.test(idText)) continue;

                const id = Number(idText);
                if (!Number.isSafeInteger(id)) continue;

                candidates.set(id, {
                    id,
                    name: item.name || null,
                    auksionUrl: parsed.href,
                    image: item.image && item.image.startsWith('https://') ? item.image : null,
                    source: 'e-auksion-listing',
                    verificationStatus: 'requires_review',
                    // Missing properties are intentional; do not replace with guesses.
                    area: null,
                    budget: null,
                    jobs: null,
                    infrastructure: null,
                    polygonCoordinates: null,
                    propertyType: 'land',
                    areaHectares: null,
                    areaVerified: false,
                    // Candidate remains in review until the official area/source is verified.
                    screening: assessInvestmentCandidate({
                        name: item.name,
                        propertyType: 'land',
                        areaHectares: null,
                        areaVerified: false
                    })
                });
            }
        }

        if (candidates.size === 0) {
            throw new Error('No verifiable lot IDs found; previous candidate file preserved');
        }

        fs.mkdirSync(path.dirname(TARGET_FILE), { recursive: true });
        const temporary = `${TARGET_FILE}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(Array.from(candidates.values()), null, 2) + '\n');
        fs.renameSync(temporary, TARGET_FILE);
        console.log(`Discovered ${candidates.size} candidate lot IDs for manual verification; no Supabase writes`);
    } finally {
        await browser.close();
    }
}

scrapePiskentAuctionCandidates().catch(err => {
    console.error('Candidate scraping failed:', err);
    process.exitCode = 1;
});
