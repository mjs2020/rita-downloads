// External deps
const path = require('path');
const fs = require('fs-extra');      // used to have promisified functions and a few extra methods like readJson
const Promise = require("bluebird"); // used for timeout and concurrency management

// Internal deps
const scraper = require('./lib/scraper');
const downloader = require('./lib/downloader');
const log = require('./lib/logger')

// Load & validate config
const config = fs.readJsonSync(path.join(__dirname, 'config.json'));
const {programs, outputBasePath, historyPath, maxRetries, downloadsPerRun} = config;
if (!config) throw new Error(`config.json undefined. Please set up config.js based on the model in config.example.json`);
if (!programs) throw new Error(`Missing programs in config. Please set up config.js based on the model in config.example.js`);
if (!outputBasePath || fs.accessSync(outputBasePath)) throw new Error(`Missing outputBasePath in config or path is not writable. Please set up config.js based on the model in config.example.js`);
if (!historyPath) throw new Error(`Missing historyPath in config. Please set up config.js based on the model in config.example.js`);
log(`Config loaded. ${programs.length} programs to scrape.`);

// load or create history.json
let history = { downloadedEpisodes: [], failedEpisodes: {} };
Promise.resolve()
    .then(() => fs.readJson(historyPath))
    .timeout(5000, 'Timeout loading history file')
    .then(historyJson => history = historyJson)
    .catch(err => {
        if (err.code !== 'ENOENT') {
            throw new Error(`Unexpected error when trying to read ./history.json: ${err}`);
        }
    })
    // Run scraping
    .then(() => Promise.map(config.programs, program => scraper(program, config), {concurrency: 2}))
    .timeout(30*60*1000, 'Timeout scraping')
    // flatten array of results
    .then(episodes => episodes.reduce((prev, curr) => prev.concat(curr), []))
    // filter out any that have already been downloaded or that have failed more than the allowed number of retries
    .then(episodes => episodes.filter(({uniqueName}) => !history.downloadedEpisodes.includes(uniqueName)))
    .then(episodes => episodes.filter(({uniqueName}) => !(history.failedEpisodes[uniqueName] && history.failedEpisodes[uniqueName]> maxRetries)))
    // limit to max dls per run
    .then(episodes => {
        if (episodes.length > downloadsPerRun) {
            log(`Found ${episodes.length} that need to be downloaded. Limiting to ${downloadsPerRun} in this run.`);
            return episodes.slice(0, downloadsPerRun)
        }
        return episodes;
    })
    // Run all downloads
    .then(episodes => Promise.map(episodes, episode => downloader(episode, config.tmpDir, config.outputBasePath), {concurrency: 2}))
    .timeout(45*60*1000, 'Timeout downloading')
    // Add successfull downloaded episodes to the history
    .then(downloads => {
        // TODO save failed downloads to a separate list and add them to separate file
        const successfulDownloads = downloads.filter(dl => dl.successful);
        const failedDownloads = downloads.filter(dl => !dl.successful);
        log(`Ran ${downloads.length} downloads of which ${successfulDownloads.length} were successful`);
        successfulDownloads.forEach(dl => {
            history.downloadedEpisodes.push(dl.uniqueName);
            delete history.failedEpisodes[dl.uniqueName];
        });
        failedDownloads.forEach(({uniqueName}) => {
            history.failedEpisodes[uniqueName] = history.failedEpisodes[uniqueName] ? history.failedEpisodes[uniqueName] + 1 : 1;
        })
        return fs.writeJson(historyPath, history, {spaces: 2})
            .then(() => {
                console.error(`Successfully updated history file.`);
            })
            .catch(err => {
                console.error(`Failed to write history to ${historyPath}. Failed with error: ${err}`);
            })
    })
    .then(() => {
        log(`Program finished, exiting.`);
        process.exit(0);
    })
    .catch(err => {
        console.error(`Unexpected error: ${err}`);
        process.exit(1);
    });