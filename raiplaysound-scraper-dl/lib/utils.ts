import path from 'path';
import assert from 'assert';

import { Config, History } from "../types";
import log from './logger';

const {promisify} = require('util');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const accessPathAsync = promisify(fs.access);
const writeFileAsync = promisify(fs.writeFile);

// timeout a promise after a given time
export async function timeout<T>(promise: Promise<T>, timeout: number, errorMsg: string): Promise<T | any> {
    return Promise.race([
        promise,
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error(errorMsg)), timeout))
    ]);
}

export async function concurrentAsync<T1, T2>(limit: number, 
                                      items: Array<T1>,
                                      itereatorFn: (item: T1) => Promise<T2>): Promise<T2[]> {
    let idx = 0;
    const running: Array<Promise<any>> = [];
    const promises: Array<Promise<any>> = [];

    if (limit >= items.length) {
        return Promise.all(items.map(i => itereatorFn(i)));
    }
    
    const enqueue: () => Promise<any> = async () => {
        if (idx === items.length) {
            return Promise.resolve();
        }
        const promise = itereatorFn(items[idx++]);
        promises.push(promise);
        running.push(promise.finally(() => running.splice(running.indexOf(promise), 1)));

        return (running.length >= limit ? Promise.race(running) : Promise.resolve())
            .finally(() => enqueue());
    }

    return enqueue().then(() => Promise.all(promises));
}

export async function readJson(filename: string) {
    return JSON.parse(await readFileAsync(filename))
}

export async function loadConfig(): Promise<Config> {
    const config: Config = await readJson(path.join(__dirname, 'config.json'));
    await validateConfig(config);
    return config;
}

async function validateConfig(config: Config) {
    const {programs, outputBasePath, historyPath} = config;
    assert.ok(config, `config.json undefined. Please set up config.js based on the model in config.example.json`);
    assert.ok(programs, `Missing programs in config. Please set up config.js based on the model in config.example.js`);
    assert.ok(outputBasePath, `Missing outputBasePath in config`);
    assert.ok(await accessPathAsync(outputBasePath), `outputBasePath not writable`);
    assert.ok(historyPath, `Missing historyPath in config. Please set up config.js based on the model in config.example.js`);
}

export async function loadHistory(historyPath: string): Promise<History> {
    try {
        return timeout(readJson(historyPath), 5000, 'Timeout loading history file');
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw new Error(`Unexpected error when trying to read ./history.json: ${err}`);
        }
    }
    return { downloadedEpisodes: [], failedEpisodes: {} };
}

export async function writeHistory(historyPath: string, history: History): Promise<void> {
    try {
        await writeFileAsync(historyPath, JSON.stringify(history, null, 2));
        log(`Successfully updated history file.`);
    } catch (err) {
        console.error(`Failed to write history to ${historyPath}. Failed with error: ${err}`);
        throw err;
    }
}