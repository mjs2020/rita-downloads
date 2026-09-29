import { Config, Episode, Program } from "../types";
import fetch from 'node-fetch';
import log from './logger';
import { URL } from 'url';
import { concurrentAsync, sleep } from "./utils";
import * as http from 'http';
import * as https from 'https';

const DEFAULT_PAGE_CONCURRENCY = 4;
const DEFAULT_JSON_CONCURRENCY = 4;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_REQUEST_RETRIES = 2;
const DEFAULT_MAX_PAGES_PER_PROGRAM = 80;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const DEFAULT_HEADERS: Record<string, string> = {
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8,it;q=0.7',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function getBaseUrl(program: Program, config: Config): string {
    if (config.baseUrl) {
        return config.baseUrl;
    }
    if (program.url.startsWith('http://') || program.url.startsWith('https://')) {
        return new URL(program.url).origin;
    }
    return '';
}

function normaliseUrl(url: string, program: Program, config: Config): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    if (url.startsWith('/')) {
        return `${getBaseUrl(program, config)}${url}`;
    }
    if (program.url.startsWith('http://') || program.url.startsWith('https://')) {
        return new URL(url, program.url).toString();
    }
    if (program.url.endsWith('/')) {
        return `${program.url}${url}`;
    }
    return `${program.url}/${url}`;
}

function getEpisodeJsonUrl(url: string, program: Program, config: Config): string | null {
    if (!url.startsWith('/audio/')) {
        return null;
    }
    return normaliseUrl(url.replace('.html', '.json'), program, config);
}

function getNestedPageUrl(url: string, program: Program, config: Config): string | null {
    if (url.startsWith('/playlist/')) {
        return normaliseUrl(url, program, config);
    }
    if (/^\/programmi\/[^/]+\/(audiolibri|playlist|clip|extra|novita|episodi)$/.test(url)) {
        return normaliseUrl(url, program, config);
    }
    if (/^\/audiolibri\/[^/]+$/.test(url)) {
        return normaliseUrl(url, program, config);
    }
    return null;
}

function isSameOriginUrl(url: string, program: Program, config: Config): boolean {
    const baseUrl = getBaseUrl(program, config);
    if (!baseUrl) {
        return !url.startsWith('http://') && !url.startsWith('https://');
    }
    try {
        return new URL(url, baseUrl).origin === new URL(baseUrl).origin;
    } catch (_err) {
        return false;
    }
}

function getPageConcurrency(config: Config): number {
    return Math.max(1, config.pageConcurrency || DEFAULT_PAGE_CONCURRENCY);
}

function getJsonConcurrency(config: Config): number {
    return Math.max(1, config.jsonConcurrency || DEFAULT_JSON_CONCURRENCY);
}

function getRequestTimeoutMs(config: Config): number {
    return Math.max(1000, config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);
}

function getRequestRetries(config: Config): number {
    // Number of retries (not counting the initial attempt)
    return Math.max(0, config.requestRetries ?? DEFAULT_REQUEST_RETRIES);
}

function getMaxPagesPerProgram(config: Config): number {
    return Math.max(1, config.maxPagesPerProgram ?? DEFAULT_MAX_PAGES_PER_PROGRAM);
}

function getFetchAgent(url: string) {
    return (new URL(url)).protocol === 'http:' ? httpAgent : httpsAgent;
}

function backoffMs(attempt: number): number {
    // attempt: 0 = first retry delay
    const base = Math.min(10_000, 500 * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * 250);
    return base + jitter;
}

async function fetchWithTimeout(url: string, config: Config): Promise<any> {
    const timeoutMs = getRequestTimeoutMs(config);
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    let timer: any;
    try {
        const fetchPromise = fetch(url, {
            headers: DEFAULT_HEADERS,
            // node-fetch v2 supports `agent` as a function or as an Agent
            agent: getFetchAgent(url) as any,
            signal: controller?.signal as any,
        } as any);

        if (!controller) {
            // Best-effort timeout on older Node runtimes: this does not cancel the underlying request.
            return await Promise.race([
                fetchPromise,
                new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error(`Timeout fetching ${url}`)), timeoutMs);
                }),
            ]);
        }

        timer = setTimeout(() => controller.abort(), timeoutMs);
        return await fetchPromise;
    } catch (err: any) {
        // Ensure timeout failures surface as a stable message (helps logs/tests and makes retries clearer).
        if (err?.name === 'AbortError') {
            throw new Error(`Timeout fetching ${url}`);
        }
        throw err;
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

async function fetchText(url: string, config: Config): Promise<string> {
    let lastErr: any;
    const retries = getRequestRetries(config);
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, config);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} fetching ${url}`);
            }
            return await response.text();
        } catch (err: any) {
            lastErr = err;
            if (attempt < retries) {
                await sleep(backoffMs(attempt));
                continue;
            }
        }
    }
    throw lastErr;
}

async function fetchJson(url: string, config: Config): Promise<any> {
    let lastErr: any;
    const retries = getRequestRetries(config);
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, config);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} fetching ${url}`);
            }
            return await response.json();
        } catch (err: any) {
            lastErr = err;
            if (attempt < retries) {
                await sleep(backoffMs(attempt));
                continue;
            }
        }
    }
    throw lastErr;
}

function extractHrefsFromHtml(html: string): string[] {
    // Keep this intentionally simple and allocation-light:
    // scan for href="..." / href='...' / href=unquoted and capture the raw value.
    const hrefs: string[] = [];
    const re = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        const href = match[1] || match[2] || match[3];
        if (href) {
            hrefs.push(href);
        }
    }
    return hrefs;
}

async function fetchEpisode(url: string, program: Program, config: Config): Promise<Episode | null> {
    const data = await fetchJson(url, config);
    const mediapolisUrl = data.downloadable_audio?.url || data.audio?.url;
    if (!mediapolisUrl) {
        return null;
    }
    return {
        mediapolisUrl,
        program,
        uniqueName: data.uniquename,
        title: `${data.title} - ${data.episode_title}`,
        date: data.date_tracking,
    };
}

export default async function scrape (program: Program, config: Config): Promise<Episode[]> {
    const visitedPages = new Set<string>();
    const queuedPages = new Set<string>();
    const pageQueue: string[] = [];

    // Keep episode discovery order stable, and keep the page URL context (used by tests/logging).
    const episodeJsonUrls: string[] = [];
    const episodeJsonSeen = new Set<string>();
    const episodeContextPage = new Map<string, string>();

    let candidateUrlCount = 0;

    const enqueuePage = (pageUrl: string) => {
        if (visitedPages.has(pageUrl) || queuedPages.has(pageUrl)) {
            return;
        }
        queuedPages.add(pageUrl);
        pageQueue.push(pageUrl);
    };

    enqueuePage(program.url);

    const maxPages = getMaxPagesPerProgram(config);
    while (pageQueue.length > 0 && visitedPages.size < maxPages) {
        const batch = pageQueue.splice(0, getPageConcurrency(config));

        const batchResults = await concurrentAsync(
            batch.length,
            batch,
            async (pageUrl) => {
                try {
                    const html = await fetchText(pageUrl, config);
                    return { pageUrl, hrefs: extractHrefsFromHtml(html) };
                } catch (err: any) {
                    // Mark as visited with no discoveries on repeated failures/timeouts.
                    log(`ERROR: ${err?.message || err}`);
                    return { pageUrl, hrefs: [] as string[] };
                }
            }
        );

        for (const result of batchResults) {
            const { pageUrl, hrefs } = result as any as { pageUrl: string, hrefs: string[] };
            queuedPages.delete(pageUrl);
            if (visitedPages.has(pageUrl)) {
                continue;
            }
            visitedPages.add(pageUrl);

            const contextProgram = { ...program, url: pageUrl };
            for (const url of hrefs) {
                if (!isSameOriginUrl(url, contextProgram, config)) {
                    continue;
                }

                const episodeUrl = getEpisodeJsonUrl(url, contextProgram, config);
                if (episodeUrl) {
                    candidateUrlCount++;
                    if (!episodeJsonSeen.has(episodeUrl)) {
                        episodeJsonSeen.add(episodeUrl);
                        episodeJsonUrls.push(episodeUrl);
                        episodeContextPage.set(episodeUrl, pageUrl);
                    }
                    continue;
                }

                const nestedPageUrl = getNestedPageUrl(url, contextProgram, config);
                if (nestedPageUrl) {
                    candidateUrlCount++;
                    enqueuePage(nestedPageUrl);
                }
            }
        }
    }

    if (visitedPages.size >= maxPages && pageQueue.length > 0) {
        log(`${program.name} (${program.url}) - Reached maxPagesPerProgram=${maxPages}, stopping page discovery early.`);
    }

    const episodes = (await concurrentAsync(
        getJsonConcurrency(config),
        episodeJsonUrls,
        (episodeUrl) => {
            const contextUrl = episodeContextPage.get(episodeUrl) || program.url;
            return fetchEpisode(episodeUrl, { ...program, url: contextUrl }, config);
        }
    )).filter((episode): episode is Episode => !!episode);

    log(`${program.name} (${program.url}) - Visited ${visitedPages.size} pages, found ${candidateUrlCount} candidate URLs, scraped ${episodes.length} episodes.`);

    // Filter by fromDate if configured
    if (program.fromDate) {
        const cutoff = new Date(program.fromDate);
        const before = episodes.filter(e => e.date < cutoff);
        if (before.length > 0) {
            log(`${program.name} - Filtered out ${before.length} episodes before ${program.fromDate}`);
        }
        return episodes.filter(e => e.date >= cutoff);
    }

    return episodes;
}
