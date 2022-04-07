import { Config, Episode, Program } from "../types";
import fetch from 'node-fetch';
import log from './logger';
import * as cheerio from 'cheerio';
import { concurrentAsync, timeout } from "./utils";

export default async function scrape (program: Program, config: Config): Promise<Episode[]> {
    log(`${program.name} - Requesting page (${program.url})`);
    const response = await fetch(program.url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const episodeUrls: string[] = [];
    const playlistUrls: string[] = [];
    $(config.jquerySelector)
        .map((i, v) => $(v).attr('href'))
        .toArray()
        .forEach(url => {
            if(url.startsWith('/audio')) {
                episodeUrls.push(`${config.baseUrl}${url.replace('.html', '.json')}`);
            } else if (url.startsWith('/playlist')) {
                playlistUrls.push(`${config.baseUrl}${url}`);
            } else {
                log(`ERROR: unknown link type: ${url} in ${program.name}`);
            }
        });

    let episodesFromPlayslits: Episode[] = [];
    for (let url of playlistUrls) {
        episodesFromPlayslits = episodesFromPlayslits.concat(await scrape({...program, url}, config));
    }

    const jsonResponses: Promise<any>[] = (await timeout(concurrentAsync(2, episodeUrls, (url: string) => fetch(url)), 60 * 1000, 'Timeout while scraping'))
        .map((response: any) => response.json());
    const episodes: Episode[] = (await Promise.all(jsonResponses))
        .map((data: any) => ({
            mediapolisUrl: data.downloadable_audio?.url,
            program: program,
            uniqueName: data.uniquename,
            title: `${data.title} - ${data.episode_title}`,
            date: data.date_tracking,
        }));
    log(`${program.name} - Scraped ${episodes.length} episodes.`);
    return [...episodes, ...episodesFromPlayslits];
}
