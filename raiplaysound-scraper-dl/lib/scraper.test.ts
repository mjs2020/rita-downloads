import fetch from 'node-fetch';
import scraper from "./scraper";
import fs from 'fs';
import { Episode, Program, Config } from '../types';
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('scraper', () => {

    beforeEach(() => jest.resetAllMocks());

    it('discovers custom-component links and legacy archive subsections, normalises URLs and filters dates', async () => {
        const program: Program = { name: 'Pagina 3', url: 'https://dummybase/programmi/pagina3', subfolder: 'Pagina 3', fromDate: '2026-09-01' };
        const config: Config = { programs: [program], outputBasePath: 'dummy', tmpDir: 'dummy', maxRetries: 0, downloadsPerRun: 1, requestRetries: 0 };
        const pages: Record<string, string> = {
            [program.url]: `<rps-cta-link weblink="/audio/2026/09/latest.html"></rps-cta-link>
                <a href="https://dummybase/audio/2026/09/latest.html?source=home&amp;x=1#play">Duplicate</a>
                <rps-cta-link weblink="//dummybase/programmi/pagina3/puntata-/2025/">Archive</rps-cta-link>
                <a href="https://external/audio/foreign.html">External</a>
                <a href="/programmi/other/puntata-/2025">Other programme</a>`,
            'https://dummybase/programmi/pagina3/puntata-/2025': `<rps-cta-link weblink="https://dummybase/audio/2025/01/old.html"></rps-cta-link>`,
        };
        const mockFetch = fetch as unknown as jest.Mock;
        mockFetch.mockImplementation(url => {
            if (pages[url]) return Promise.resolve(new Response(pages[url]));
            if (url === 'https://dummybase/audio/2026/09/latest.json' || url === 'https://dummybase/audio/2025/01/old.json') {
                return Promise.resolve(new Response(JSON.stringify({
                    uniquename: url, title: 'Pagina 3', episode_title: 'Episode',
                    date_tracking: url.includes('/2026/') ? '2026-09-30' : '2025-01-01',
                    audio: { url: 'https://media/audio.mp3' },
                })));
            }
            throw new Error(`Unexpected request ${url}`);
        });
        const episodes = await scraper(program, config);
        expect(episodes.map(e => e.uniqueName)).toEqual(['https://dummybase/audio/2026/09/latest.json']);
        expect(mockFetch.mock.calls.map(call => call[0])).toEqual([
            program.url, 'https://dummybase/programmi/pagina3/puntata-/2025',
            'https://dummybase/audio/2026/09/latest.json', 'https://dummybase/audio/2025/01/old.json',
        ]);
    });

    it('never exceeds the page limit even when page concurrency is higher', async () => {
        const program: Program = { name: 'dummy', url: 'https://dummybase/programmi/dummy', subfolder: 'dummy' };
        const config: Config = { programs: [program], outputBasePath: 'dummy', tmpDir: 'dummy', maxRetries: 0, downloadsPerRun: 1, maxPagesPerProgram: 2, pageConcurrency: 3 };
        const mockFetch = fetch as unknown as jest.Mock;
        mockFetch.mockImplementation(() => Promise.resolve(new Response('<a href="/playlist/one">1</a><a href="/playlist/two">2</a><a href="/playlist/three">3</a>')));
        await scraper(program, config);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    const fetchResponse = (file: string): Promise<any> =>
        Promise.resolve(new Response(fs.readFileSync(file)));

    it('should scrape episodes from the current programme -> subsection -> audiobook flow', async () => {
        const program: Program = { name: 'dummy', url: 'https://dummybase/programmes/adaltavoce', subfolder: 'dummy' };
        const config: Config = {
            programs: [program],
            outputBasePath: 'dummy',
            tmpDir: 'dummy',
            baseUrl: 'https://dummybase',
            maxRetries: 0,
            downloadsPerRun: 1,
        };
        (<jest.Mock><unknown>fetch)
            .mockImplementation(url => {
                if (url === 'https://dummybase/programmes/adaltavoce') {
                    return fetchResponse('./lib/fixtures/programme-current.html');
                }
                if (url === 'https://dummybase/programmi/adaltavoce/audiolibri') {
                    return fetchResponse('./lib/fixtures/programme-audiolibri-current.html');
                }
                if (url === 'https://dummybase/audiolibri/uominieno') {
                    return fetchResponse('./lib/fixtures/audiobook-uominieno-current.html');
                }
                const matches = url.match(/([^\/]+$)/);
                if (matches && matches[0]) {
                    return fetchResponse(`./lib/fixtures/${matches[0]}`);
                }
                throw new Error('Unexpected request');
            });

        const episodes: Episode[] = await scraper(program, config);
        expect(episodes).toEqual([
            {
                mediapolisUrl: 'https://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=IPeOssSlashfPUe4KydG6MDWuHkweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'https://dummybase/audiolibri/uominieno'},
                uniqueName: 'ContentItem-b4a1d882-4556-4856-a8d6-140f03630bb4',
                title: 'Ad alta voce del 10/04/2026 - 10. Uomini e no',
                date: '2026-04-10'
            },
            {
                mediapolisUrl: 'https://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=tMnCNr8MUYvtnwTSRFtFMweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'https://dummybase/audiolibri/uominieno'},
                uniqueName: 'ContentItem-be20f4a4-0c87-4c35-b01e-63b2d6288acc',
                title: 'Ad alta voce del 09/04/2026 - 9. Uomini e no',
                date: '2026-04-09'
            }
        ]);
    });

    it('should discover current markup without selector config and ignore off-origin links', async () => {
        const program: Program = {
            name: 'dummy',
            url: 'https://www.raiplaysound.it/programmi/adaltavoce',
            subfolder: 'dummy'
        };
        const config: Config = {
            programs: [program],
            outputBasePath: 'dummy',
            tmpDir: 'dummy',
            baseUrl: '',
            maxRetries: 0,
            downloadsPerRun: 1,
        };
        (<jest.Mock><unknown>fetch)
            .mockImplementation(url => {
                if (url === 'https://www.raiplaysound.it/programmi/adaltavoce') {
                    return fetchResponse('./lib/fixtures/programme-current-with-external.html');
                }
                if (url === 'https://www.raiplaysound.it/programmi/adaltavoce/audiolibri') {
                    return fetchResponse('./lib/fixtures/programme-audiolibri-current.html');
                }
                if (url === 'https://www.raiplaysound.it/audiolibri/uominieno') {
                    return fetchResponse('./lib/fixtures/audiobook-uominieno-current.html');
                }
                const matches = url.match(/([^\/]+$)/);
                if (matches && matches[0]) {
                    return fetchResponse(`./lib/fixtures/${matches[0]}`);
                }
                throw new Error(`Unexpected request ${url}`);
            });

        const episodes: Episode[] = await scraper(program, config);
        expect(episodes).toHaveLength(2);
        expect(episodes[0].uniqueName).toBe('ContentItem-b4a1d882-4556-4856-a8d6-140f03630bb4');
        expect(episodes[1].uniqueName).toBe('ContentItem-be20f4a4-0c87-4c35-b01e-63b2d6288acc');
    });

    it('should handle playlists', async () => {
        const program: Program = { name: 'dummy', url: 'https://dummybase/programmes/dummy', subfolder: 'dummy' };
        const config: Config = {
            programs: [program],
            outputBasePath: 'dummy',
            tmpDir: 'dummy',
            baseUrl: 'https://dummybase',
            maxRetries: 0,
            downloadsPerRun: 1,
        };
        (<jest.Mock><unknown>fetch)
            .mockImplementation(url => {
                if (url === 'https://dummybase/programmes/dummy') {
                    return fetchResponse('./lib/fixtures/programme-with-playlists.html');
                }
                const matches = url.match(/([^\/]+$)/);
                if (matches && matches[0]) {
                    return fetchResponse(`./lib/fixtures/${matches[0]}`);
                }
                throw new Error('Unexpected request');
            });

            const episodes: Episode[] = await scraper(program, config);
            expect(episodes).toEqual([
                {
                  mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=vCPLcy2j1MvCGY8kblw13geeqqEEqualeeqqEEqual',
                  program: { name: 'dummy', url: 'https://dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-1dcb9c9a-5378-4ef3-98ae-64ac9f546735',
                  title: 'Mercè Rodoreda | Il giardino dei fiori blu - 1. Mercè Rodoreda | Il giardino dei fiori blu',
                  date: '2022-03-23'
                },
                {
                  mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=kINacObl4mv5JpinEU7ptweeqqEEqualeeqqEEqual',
                  program: { name: 'dummy', url: 'https://dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-134a24ab-0dec-4a10-bf48-fa4f6ed71076',
                  title: 'Mercè Rodoreda  | L\'amore fa schifo - 2. Mercè Rodoreda  | L\'amore fa schifo',
                  date: '2022-03-23'
                },
                {
                  mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=vssSlashWy8dGoQNSFGMO92dThssSlashAeeqqEEqualeeqqEEqual',
                  program: { name: 'dummy', url: 'https://dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-b336bed4-9355-4617-b86f-7780546a82b9',
                  title: 'Mercè Rodoreda | Il bibliobus - 3. Mercè Rodoreda | Il bibliobus',
                  date: '2022-03-23'
                }
              ]);
    });

});
