import { Config, Episode, Program } from "../types";
import fetch from 'node-fetch';
import log from './logger';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { iterateAsync, timeout } from "./utils";

const DISCOVERY_SELECTOR = 'a[href], [href]';

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

async function scrapePage(program: Program, config: Config, visitedPages: Set<string>): Promise<Episode[]> {
    if (visitedPages.has(program.url)) {
        return [];
    }
    visitedPages.add(program.url);

    const response = await fetch(program.url);
    const html = await response.text();
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

    let episodesFromNestedPages: Episode[] = [];
    for (let url of [...new Set(nestedPageUrls)]) {
        episodesFromNestedPages = episodesFromNestedPages.concat(await scrapePage({...program, url}, config, visitedPages));
    }

    const jsonResponses: Promise<any>[] = (await timeout(
            iterateAsync([...new Set(episodeUrls)], (url) => fetch(url)),
            10 * 60 * 1000,
            `Timeout while gathering json repsponses for ${program.name}`)
        )
        .map((response: any) => response.json());
    const episodes: Episode[] = (await Promise.all(jsonResponses))
        .map((data: any) => ({
            mediapolisUrl: data.downloadable_audio?.url || data.audio?.url,
            program: program,
            uniqueName: data.uniquename,
            title: `${data.title} - ${data.episode_title}`,
            date: data.date_tracking,
        }))
        .filter(e => !!e.mediapolisUrl);
    log(`${program.name} (${program.url}) - Found ${candidateUrlCount} candidate URLs, scraped ${episodes.length} episodes.`);
    return [...episodes, ...episodesFromNestedPages];
}

export default async function scrape (program: Program, config: Config): Promise<Episode[]> {
    return scrapePage(program, config, new Set<string>());
}
