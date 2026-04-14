import path from 'path';

// Types
import { DownloadResult, DownloadResults, Episode } from './types';

// Internal deps
import scraper from './lib/scraper';
import downloader from './lib/downloader';
import log from './lib/logger';
import { concurrentAsync, iterateAsync, loadConfig, loadHistory, timeout, writeHistory } from './lib/utils';
import moment from 'moment';

const DEFAULT_PROGRAM_CONCURRENCY = 2;
const DEFAULT_SCRAPE_TIMEOUT_MS = 30*60*1000;

// Load & validate config
(async function main () {
    try {
        // load config
        const config = await loadConfig();
        const {programs, outputBasePath, maxRetries, downloadsPerRun, tmpDir} = config;
        const programConcurrency = Math.max(1, config.programConcurrency || DEFAULT_PROGRAM_CONCURRENCY);
        const scrapeTimeoutMs = Math.max(60*1000, config.scrapeTimeoutMs || DEFAULT_SCRAPE_TIMEOUT_MS);
        const version = __APP_VERSION__;
        log(`raiplaysound-scraper v${version}`);
        log(`Config loaded. ${programs.length} programs to scrape.`);
        log(`Scrape concurrency: programs=${programConcurrency}, pages=${Math.max(1, config.pageConcurrency || 4)}, json=${Math.max(1, config.jsonConcurrency || 4)}, requestTimeoutMs=${Math.max(1000, config.requestTimeoutMs || 20000)}, scrapeTimeoutMs=${scrapeTimeoutMs}`);
        
        // load or create history.json
        const {downloadedEpisodes, failedEpisodes} = await loadHistory();
        
        // scrape episodes & filter out ones we've already downloaded or failed too many times
        const scrapedEpisodes = (await timeout(
                concurrentAsync(programConcurrency, programs, program => scraper(program, config)),
                scrapeTimeoutMs,
                'Timeout while scraping programs'
            ))
            .reduce((prev: [Episode], curr: Episode) => prev.concat(curr), [])
        const newEpisodes = scrapedEpisodes
            .filter(({uniqueName}: Episode) => !downloadedEpisodes.includes(uniqueName))
            .filter(({uniqueName}: Episode) => !(failedEpisodes[uniqueName] && failedEpisodes[uniqueName] > maxRetries))
        const episodesToDownload = newEpisodes.sort((a: Episode, b: Episode) => moment(b.date).unix() - moment(a.date).unix())
            .slice(0, downloadsPerRun);

        log('');
        log('----------------------------------------');
        log(`Total of ${scrapedEpisodes.length} scraped, ${newEpisodes.length} new ones, downloading ${episodesToDownload.length}`);
        log('----------------------------------------');
        log('');

        // download episodes & split into successful/failed Episode arrays
        const {successfulDownloads, failedDownloads}: DownloadResults = (await timeout(
            iterateAsync<Episode, DownloadResult>(episodesToDownload, episode => downloader(episode, tmpDir, outputBasePath)),
                45*60*1000, // 45min
                'Timeout while downloading'
            )).reduce((acc: DownloadResults, download: DownloadResult) => {
                if (download.successful) {
                    acc.successfulDownloads.push(download.episode);
                } else {
                    acc.failedDownloads.push(download.episode);
                }
                return acc;
            }, new DownloadResults);
        log(`Ran ${successfulDownloads.length+failedDownloads.length} downloads of which ${successfulDownloads.length} were successful`);
        
        // write results to history & write history to disk
        successfulDownloads.forEach(({uniqueName}) => {
            downloadedEpisodes.push(uniqueName);
            delete failedEpisodes[uniqueName];
        });
        failedDownloads.forEach(({uniqueName}) => {
            failedEpisodes[uniqueName] = failedEpisodes[uniqueName] ? failedEpisodes[uniqueName] + 1 : 1;
        });
        await writeHistory({downloadedEpisodes, failedEpisodes});
        
        log(`Program finished, exiting.`);
        process.exit(0);
    } catch (err) {
        console.error(`Unexpected error: ${err}`);
        process.exit(1);
    }
})();
