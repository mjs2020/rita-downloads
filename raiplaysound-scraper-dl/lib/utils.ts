const {promisify} = require('util')
const fs = require('fs')
const readFileAsync = promisify(fs.readFile)

// timeout a promise after a given time
export async function timeout(promise: Promise<any>, timeout: number, errorMsg: string) {
    return Promise.race([
        promise,
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error(errorMsg)), timeout))
    ]);
}

export async function concurrentAsync(limit: number, 
                                      items: Array<any>,
                                      itereatorFn: Function): Promise<any[]> {
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

