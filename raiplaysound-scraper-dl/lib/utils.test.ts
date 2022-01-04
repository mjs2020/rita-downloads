import { concurrentAsync, timeout } from "./utils";

describe('utils', () => {

    describe('timeout', () => {

        const TIMED_OUT = 'timed out';
        const BAILED = "bailed";
        const SUCCESS = 'success';

        it('should reject when timing out and promise resolves', async () => {
            await expect(
                timeout(resolvesIn(10, SUCCESS), 5, TIMED_OUT)
            ).rejects.toThrow(TIMED_OUT);
        });

        it('should reject when timing out and promise rejects', async () => {
            await expect(
                timeout(rejectsIn(10, BAILED), 5, TIMED_OUT)
            ).rejects.toThrow(TIMED_OUT);
        });

        it('should reject when promise rejects before timeout', async () => {
            await expect(
                timeout(rejectsIn(5, BAILED), 10, TIMED_OUT)
            ).rejects.toThrow(BAILED);
        });

        it('should resolve when promise resolves before timeout', async () => {
            await expect(
                timeout(resolvesIn(5, SUCCESS), 10, TIMED_OUT)
            ).resolves.toBe(SUCCESS);
        });

    });

    describe('concurrentAsync', () => {
        
        const values= [0,1,2,3,4,5,6,7,8,9];
        const concurrency = 2;

        it('should wait for all promises to resolve', async () => {
            // resolves after random delay between 1 and 10ms
            const randomResolve = (value: any) => new Promise((resolve) => setTimeout(() => resolve(value), Math.round(Math.random()*10)))
            await expect(
                concurrentAsync(concurrency, values, randomResolve)
            ).resolves.toEqual(values);
        });
            
        it('should ensure only n promises run concurrently', async () => {
            let concurrent = 0;
            const checker = (v: any) => new Promise((resolve) => setTimeout(() => {
                expect(concurrent).toBeLessThanOrEqual(concurrency)
                resolve(v);
            }, Math.round(Math.random()*10)))
            await expect(
                concurrentAsync(concurrency, values, checker)
            ).resolves.toEqual(values);
        });
        
        it('should reject if any of the promises reject', async () => {
            const TRIGGERED = "triggered"
            const checker = (v: any) => new Promise((resolve, reject) => setTimeout(() => v === values[5] ? reject(TRIGGERED) : resolve(v), Math.round(Math.random()*10)));
            await expect(
                concurrentAsync(concurrency, values, checker)
            ).rejects.toEqual(TRIGGERED);
        });
    });
});


function resolvesIn(time: number, value: string): Promise<string> {
    return new Promise((resolve) => setTimeout(() => resolve(value), time));
}

function rejectsIn(time: number, errMsg: string): Promise<string> {
    return new Promise((_resolve, reject) => setTimeout(() => reject(new Error(errMsg)), time));
}