import path from 'path';
import assert from 'assert';
import { rename } from 'fs';
import { promisify } from 'util';

import { Config, History } from "../types";
import log from './logger';

const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const renameAsync = promisify(rename);

// timeout a promise after a given time
export async function timeout<T>(promise: Promise<T>, timeout: number, errorMsg: string): Promise<T | any> {
    let timer: any;
    const timeoutPromise = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(errorMsg)), timeout);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

export async function concurrentAsync<T1, T2>(limit: number,
    items: Array<T1>,
    itereatorFn: (item: T1) => Promise<T2>): Promise<T2[]> {
    const safeLimit = Math.max(1, limit);
    if (items.length === 0) {
        return [];
    }

    // Worker-pool implementation:
    // - only keeps `safeLimit` in-flight Promises instead of O(items.length)
    // - preserves input order for successful results
    const results: Array<T2 | undefined> = new Array(items.length);
    let nextIndex = 0;

    const runItem = async (item: T1): Promise<T2 | undefined> => {
        try {
            return await itereatorFn(item);
        } catch (e: any) {
            console.log(`ERROR: ${e?.message || e}`);
            return undefined;
        }
    };

    const worker = async (): Promise<void> => {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) {
                return;
            }
            results[currentIndex] = await runItem(items[currentIndex]);
        }
    };

    const workerCount = Math.min(safeLimit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results.filter((r): r is T2 => r !== undefined);
}

export async function readJson(filename: string) {
    return JSON.parse(await readFileAsync(filename))
}

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loadConfig(): Promise<Config> {
    const config: Config = await readJson(path.join(__dirname, 'config.json'));
    await validateConfig(config);
    return config;
}

async function validateConfig(config: Config) {
    const { programs, outputBasePath } = config;
    assert.ok(config, `config.json undefined. Please set up config.js based on the model in config.example.json`);
    assert.ok(programs, `Missing programs in config. Please set up config.js based on the model in config.example.js`);
    assert.ok(outputBasePath, `Missing outputBasePath in config`);
    // console.log('output path ', path.join(__dirname, '../', outputBasePath))
    // assert.ok(await accessAsync(path.join(__dirname, '../', outputBasePath), fs.constants.W_OK), `outputBasePath is not writable`);
}

export async function loadHistory(): Promise<History> {
    try {
        const history = await timeout(readJson(path.join(__dirname, 'history.json')), 5000, 'Timeout loading history file');
        // Migrate old schema (no taskQueue / programLastScraped)
        if (!history.taskQueue) history.taskQueue = [];
        if (!history.programLastScraped) history.programLastScraped = {};
        log(`History loaded. ${history.downloadedEpisodes.length} downloaded episodes in history, ${Object.keys(history.failedEpisodes).length} failed episodes, ${history.taskQueue.length} in queue.`);
        return history;
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw new Error(`Unexpected error when trying to read ./history.json: ${err}`);
        }
    }
    log(`Could not find history file, initialising empty one`);
    return { downloadedEpisodes: [], failedEpisodes: {}, taskQueue: [], programLastScraped: {} };
}

export async function writeHistory(history: History): Promise<void> {
    try {
        const historyPath = path.join(__dirname, 'history.json');
        const tmpPath = historyPath + '.tmp';
        await writeFileAsync(tmpPath, JSON.stringify(history, null, 2));
        await renameAsync(tmpPath, historyPath);
        log(`Successfully updated history file.`);
    } catch (err) {
        console.error(`Failed to write history. Failed with error: ${err}`);
        throw err;
    }
}

export async function iterateAsync<T1, T2>(items: T1[], itereatorFn: (item: T1) => Promise<T2>): Promise<T2[]> {
    const results = []
    for (let item of items) {
        try {
            results.push(await itereatorFn(item));
        } catch (e: any) {
            console.log(`ERROR: ${e.message}`)
        }
    }
    return results;
}
