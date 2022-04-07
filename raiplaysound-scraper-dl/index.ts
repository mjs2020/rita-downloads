import path from 'path';

// Types
import { DownloadResult, DownloadResults, Episode, History, Program } from './types';

// Internal deps
import scraper from './lib/scraper';
import downloader from './lib/downloader';
import log from './lib/logger';
import { concurrentAsync, loadConfig, loadHistory, timeout, writeHistory } from './lib/utils';

// Load & validate config
(async function main () {
    try {
        // load config
        const config = await loadConfig();
        const {programs, outputBasePath, historyPath, maxRetries, downloadsPerRun, tmpDir} = config;
        log(`Config loaded. ${programs.length} programs to scrape.`);
        
        // load or create history.json
        const {downloadedEpisodes, failedEpisodes} = await loadHistory(historyPath);
        log(`History loaded. ${downloadedEpisodes.length} downloaded episodes in history, ${Object.keys(failedEpisodes).length} failed episodes.`);
        
        // scrape episodes & filter out ones we've already downloaded or failed too many times
        const episodes = (await timeout(
                concurrentAsync<Program, Episode[]>(2, programs, program => scraper(program, config)),
                30*60*1000, //30 min
                'Timeout while scraping'
            ))
            .reduce((prev: [Episode], curr: Episode) => prev.concat(curr), [])
            .filter(({uniqueName}: Episode) => !downloadedEpisodes.includes(uniqueName))
            .filter(({uniqueName}: Episode) => !(failedEpisodes[uniqueName] && failedEpisodes[uniqueName] > maxRetries))
            .slice(0, downloadsPerRun);

        // download episodes & split into successful/failed Episode arrays
        const {successfulDownloads, failedDownloads}: DownloadResults = (await timeout(
                concurrentAsync<Episode, DownloadResult>(2, episodes, episode => downloader(episode, tmpDir, outputBasePath)),
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
        await writeHistory(historyPath, {downloadedEpisodes, failedEpisodes});
        
        log(`Program finished, exiting.`);
        process.exit(0);
    } catch (err) {
        console.error(`Unexpected error: ${err}`);
        process.exit(1);
    }
})();
