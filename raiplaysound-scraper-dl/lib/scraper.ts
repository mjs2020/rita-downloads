import { Config, Episode, Program } from "../types";
import fetch from 'node-fetch';
import log from './logger';
import * as cheerio from 'cheerio';
import { concurrentAsync, timeout } from "./utils";

export default async function (program: Program, config: Config): Promise<Episode[]> {
    log(`${program.name} - Requesting page`);
    const response = await fetch(program.url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const episodeUrls = $(config.jquerySelector)
        .map((i, v) => config.baseUrl + $(v).attr('href')?.replace('.html', '.json'))
        .toArray();
    const jsonResponses: Promise<any>[] = (await timeout(concurrentAsync(2, episodeUrls, (url: string) => fetch(url)), 60 * 1000, 'Timeout while scraping'))
        .map((response: any) => response.json());
    const episodes: Episode[] = (await Promise.all(jsonResponses))
        .map((data: any) => ({
            mediapolisUrl: data.downloadable_audio?.url,
            program: data.program?.name,
            uniqueName: data.uniquename,
            title: data.title,
            date: data.date_tracking,
        }));
    log(`${program.name} - Scraped ${episodes.length} episodes.`);
    return episodes;
}
