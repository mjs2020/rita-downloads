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
const DEFAULT_SCRAPE_INTERVAL_MS = 86400000; // 24 hours
const DEFAULT_PROGRAMS_PER_SCRAPE = 5;

// Load & validate config
(async function main () {
    try {
        // load config
        const config = await loadConfig();
        const {programs, outputBasePath, maxRetries, downloadsPerRun, tmpDir, scrapeInterval, programsPerScrape} = config;
        const programConcurrency = Math.max(1, config.programConcurrency || DEFAULT_PROGRAM_CONCURRENCY);
        const scrapeTimeoutMs = Math.max(60*1000, config.scrapeTimeoutMs || DEFAULT_SCRAPE_TIMEOUT_MS);
        const intervalMs = scrapeInterval || DEFAULT_SCRAPE_INTERVAL_MS;
        const perScrape = programsPerScrape || DEFAULT_PROGRAMS_PER_SCRAPE;
        const version = __APP_VERSION__;
        log(`raiplaysound-scraper v${version}`);
        log(`Config loaded. ${programs.length} programs to scrape.`);
        log(`Scrape concurrency: programs=${programConcurrency}, pages=${Math.max(1, config.pageConcurrency || 4)}, json=${Math.max(1, config.jsonConcurrency || 4)}, requestTimeoutMs=${Math.max(1000, config.requestTimeoutMs || 20000)}, scrapeTimeoutMs=${scrapeTimeoutMs}`);
        
        // load or create history.json
        const history = await loadHistory();
        const {downloadedEpisodes, failedEpisodes, taskQueue, programLastScraped} = history;
        const downloadedEpisodeSet = new Set(downloadedEpisodes);
        
        // --- Scrape phase ---
        const now = Date.now();
        // Filter programs that haven't been scraped within the interval
        const eligible = programs.filter(p => {
            const last = programLastScraped[p.name];
            return !last || (now - new Date(last).getTime()) > intervalMs;
        });
        
        if (eligible.length > 0) {
            // Sort by oldest lastScraped first (programs never scraped go first)
            eligible.sort((a, b) => {
                const aTime = programLastScraped[a.name] ? new Date(programLastScraped[a.name]).getTime() : 0;
                const bTime = programLastScraped[b.name] ? new Date(programLastScraped[b.name]).getTime() : 0;
                return aTime - bTime;
            });
            
            // Limit to programsPerScrape
            const toScrape = eligible.slice(0, perScrape);
            log(`Scraping ${toScrape.length} programs: ${toScrape.map(p => p.name).join(', ')}. ${taskQueue.length} episodes in queue.`);
            
            // Mark all programs as scraped before starting, so a failure in one doesn't block the others
            toScrape.forEach(p => {
                programLastScraped[p.name] = new Date().toISOString();
            });
            
            const scrapedEpisodeGroups = (await timeout(
                    concurrentAsync(programConcurrency, toScrape, program => scraper(program, config)),
                    scrapeTimeoutMs,
                    'Timeout while scraping programs'
                )) as Episode[][];
            
            const newEpisodes: Episode[] = [];
            for (const group of scrapedEpisodeGroups) {
                if (group && group.length) {
                    for (const ep of group) {
                        if (!downloadedEpisodeSet.has(ep.uniqueName) && !taskQueue.find(t => t.uniqueName === ep.uniqueName)) {
                            newEpisodes.push(ep);
                        }
                    }
                }
            }
            log(`Scrape complete. Found ${newEpisodes.length} new episodes to enqueue.`);
            taskQueue.push(...newEpisodes);
            
            // Remove from queue any episodes that were downloaded while queued
            for (const dl of downloadedEpisodes) {
                const idx = taskQueue.findIndex(t => t.uniqueName === dl);
                if (idx !== -1) {
                    taskQueue.splice(idx, 1);
                }
            }
            log(`Task queue now has ${taskQueue.length} episodes pending.`);
        } else {
            log(`All programs scraped within interval. ${taskQueue.length} episodes in queue.`);
        }
        
        // --- Download phase ---
        if (taskQueue.length > 0) {
            let toDownload = taskQueue.filter(({uniqueName}) =>
                !(failedEpisodes[uniqueName] && failedEpisodes[uniqueName] > maxRetries)
            );
            
            if (toDownload.length > downloadsPerRun) {
                log(`Found ${toDownload.length} episodes to download. Limiting to ${downloadsPerRun} in this run.`);
                toDownload = toDownload.slice(0, downloadsPerRun);
            }
            
            log('');
            log('----------------------------------------');
            log(`Downloading ${toDownload.length} episodes from queue of ${taskQueue.length}`);
            log('----------------------------------------');
            log('');
            
            const downloads: DownloadResults = (await timeout(
                iterateAsync<Episode, DownloadResult>(toDownload, episode => downloader(episode, tmpDir, outputBasePath)),
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
            log(`Ran ${downloads.successfulDownloads.length+downloads.failedDownloads.length} downloads of which ${downloads.successfulDownloads.length} were successful`);
            
            // Update history
            downloads.successfulDownloads.forEach(({uniqueName}) => {
                downloadedEpisodes.push(uniqueName);
                delete failedEpisodes[uniqueName];
            });
            downloads.failedDownloads.forEach(({uniqueName}) => {
                failedEpisodes[uniqueName] = failedEpisodes[uniqueName] ? failedEpisodes[uniqueName] + 1 : 1;
            });
            
            // Remove downloaded episodes from the queue
            const downloadedNames = new Set(downloads.successfulDownloads.map((dl: Episode) => dl.uniqueName));
            for (let i = taskQueue.length - 1; i >= 0; i--) {
                if (downloadedNames.has(taskQueue[i].uniqueName)) {
                    taskQueue.splice(i, 1);
                }
            }
            log(`Queue now has ${taskQueue.length} episodes remaining.`);
        } else {
            log(`No episodes in queue. Nothing to download.`);
        }
        
        // write results to history & write history to disk
        await writeHistory({downloadedEpisodes, failedEpisodes, taskQueue, programLastScraped});
        
        log(`Program finished, exiting.`);
        process.exit(0);
    } catch (err) {
        console.error(`Unexpected error: ${err}`);
        process.exit(1);
    }
})();
