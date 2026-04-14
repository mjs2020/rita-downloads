import { Config, Episode, Program } from "../types";
import fetch from 'node-fetch';
import log from './logger';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { concurrentAsync, timeout } from "./utils";

const DISCOVERY_SELECTOR = 'a[href], [href]';
const DEFAULT_PAGE_CONCURRENCY = 4;
const DEFAULT_JSON_CONCURRENCY = 4;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

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

async function fetchTextWithTimeout(url: string, config: Config): Promise<string> {
    const response = await timeout(
        fetch(url),
        getRequestTimeoutMs(config),
        `Timeout fetching ${url}`
    );
    return timeout(
        response.text(),
        getRequestTimeoutMs(config),
        `Timeout reading HTML from ${url}`
    );
}

async function fetchEpisode(url: string, program: Program, config: Config): Promise<Episode | null> {
    const response = await timeout(
        fetch(url),
        getRequestTimeoutMs(config),
        `Timeout fetching episode JSON ${url}`
    );
    const data = await timeout(
        response.json(),
        getRequestTimeoutMs(config),
        `Timeout reading episode JSON ${url}`
    );
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

async function scrapePage(program: Program, config: Config, visitedPages: Set<string>): Promise<Episode[]> {
    if (visitedPages.has(program.url)) {
        return [];
    }
    visitedPages.add(program.url);

    const html = await fetchTextWithTimeout(program.url, config);
    const $ = cheerio.load(html);

    const episodeUrls: string[] = [];
    const nestedPageUrls: string[] = [];
    let candidateUrlCount = 0;

    const discoveredUrls = $(DISCOVERY_SELECTOR)
        .map((i, v) => $(v).attr('href'))
        .toArray()
        .filter((url): url is string => !!url);

    discoveredUrls.forEach(url => {
            if (!isSameOriginUrl(url, program, config)) {
                return;
            }

            const episodeUrl = getEpisodeJsonUrl(url, program, config);
            if (episodeUrl) {
                candidateUrlCount++;
                episodeUrls.push(episodeUrl);
                return;
            }

            const nestedPageUrl = getNestedPageUrl(url, program, config);
            if (nestedPageUrl) {
                candidateUrlCount++;
                nestedPageUrls.push(nestedPageUrl);
            }
        });

    const nestedPageResults = await concurrentAsync(
        getPageConcurrency(config),
        [...new Set(nestedPageUrls)],
        (url) => scrapePage({ ...program, url }, config, visitedPages)
    );
    const episodesFromNestedPages = nestedPageResults.reduce((all, current) => all.concat(current), [] as Episode[]);

    const episodes = (await concurrentAsync(
        getJsonConcurrency(config),
        [...new Set(episodeUrls)],
        (url) => fetchEpisode(url, program, config)
    )).filter((episode): episode is Episode => !!episode);
    log(`${program.name} (${program.url}) - Found ${candidateUrlCount} candidate URLs, scraped ${episodes.length} episodes.`);
    return [...episodes, ...episodesFromNestedPages];
}

export default async function scrape (program: Program, config: Config): Promise<Episode[]> {
    return scrapePage(program, config, new Set<string>());
}
