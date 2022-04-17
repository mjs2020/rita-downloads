import path from 'path';

// Types
import { DownloadResult, DownloadResults, Episode } from './types';

// Internal deps
import scraper from './lib/scraper';
import downloader from './lib/downloader';
import log from './lib/logger';
import { iterateAsync, loadConfig, loadHistory, timeout, writeHistory } from './lib/utils';
import moment from 'moment';

// Load & validate config
(async function main () {
    try {
        // load config
        const config = await loadConfig();
        const {programs, outputBasePath, maxRetries, downloadsPerRun, tmpDir} = config;
        log(`Config loaded. ${programs.length} programs to scrape.`);
        
        // load or create history.json
        const {downloadedEpisodes, failedEpisodes} = await loadHistory();
        
        // scrape episodes & filter out ones we've already downloaded or failed too many times
        const scrapedEpisodes = (await timeout(
                iterateAsync(programs, program => scraper(program, config)),
                30*60*1000, //30 min
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
