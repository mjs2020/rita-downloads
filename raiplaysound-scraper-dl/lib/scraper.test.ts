import fetch from 'node-fetch';
import scraper from "./scraper";
import fs from 'fs';
import { Episode, Program, Config } from '../types';
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('scraper', () => {

    const fetchResponse = (file: string): Promise<any> =>
        Promise.resolve(new Response(fs.readFileSync(file)));

    it('should return the correct list of episodes', async () => {
        const program: Program = { name: 'dummy', url: 'dummy', subfolder: 'dummy' };
        const config: Config = {
            programs: [program],
            outputBasePath: 'dummy',
            historyPath: 'dummy',
            tmpDir: 'dummy',
            baseUrl: 'dummybase',
            jquerySelector: 'article > a',
            maxRetries: 0,
            downloadsPerRun: 1,
        };
        (<jest.Mock><unknown>fetch)
            .mockImplementation(url => {
                if (url === 'dummy') {
                    return fetchResponse('./lib/fixtures/programme.html');
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
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=Kro7ddh4v8MBx7A9WCU0xQeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-1a2318b5-6809-46b8-808b-411169658789',
                title: 'Ad alta voce del 03/03/2022 - 20. Il paese di Cuccagna di Matilde Serao',
                date: '2022-03-03'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=SHYZK37ssSlash6ssSlashbbR1L6ZBvTCweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-f464a407-69ad-4281-aa37-f6cb29a709ff',
                title: 'Ad alta voce del 02/03/2022 - 19. Il paese di Cuccagna di Matilde Serao',
                date: '2022-03-02'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=KZB4ssSlashwa8WogU0aBL6Hd0SgeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-8c363d5b-4a32-413c-9307-01c27870d9eb',
                title: 'Ad alta voce del 01/03/2022 - 18. Il paese di Cuccagna di Matilde Serao',
                date: '2022-03-01'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=pYcfxJ7csVeCjjpPpPlussp7sIGpPpPlussgeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-ef90a2e7-d356-4a14-a844-01c5805fc8ff',
                title: 'Ad alta voce del 28/02/2022 - 16. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-28'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=lbtZb5FbSNhKiTMYT6xspPpPlussweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-92bdd243-9465-4a95-bc32-1f8273fc3be1',
                title: 'Ad alta voce del 25/02/2022 - 15. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-25'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=mbvpPpPlussRXLplKpPpPlussEIlyHsamgHAeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-df67b393-006b-487e-a237-c5de45d15a54',
                title: 'Ad alta voce del 24/02/2022 - 14. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-24'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=LM6pOmssSlash5ssMb3BUIZDfgwweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-7f879c25-dffb-4b82-8fd1-0a5d7368b7fb',
                title: 'Ad alta voce del 23/02/2022 - 13. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-23'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=K8ryIQO9eXV5WmLTRpIHCweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-95b2eb3f-cea9-419d-a8b4-a210c0b1047d',
                title: 'Ad alta voce del 22/02/2022 - 12. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-22'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=nHAtxxNICKtwJ0Zwr3F8ugeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-63aac4ab-9e42-4cf1-bb5b-304b115e17b3',
                title: 'Ad alta voce del 21/02/2022 - 11. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-21'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=Lbju1HypPpPluss4CfYxvPR7sON0QeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-4b2cdddd-759f-4ec4-8b25-40e20f5d0bfa',
                title: 'Ad alta voce del 18/02/2022 - 10. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-18'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=qCDRnSXwZBPzmo6wLBRh9QeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-a9216215-2aa5-49f0-af72-c8c3eb4809b4',
                title: 'Ad alta voce del 17/02/2022 - 9. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-17'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=pPpPlussA8wxHVeZKrcuGVxlOeQLAeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-e5e4567c-84e9-4d7a-9d5a-3624d0086b74',
                title: 'Ad alta voce del 16/02/2022 - 8. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-16'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=lmFHeGsNXtPldLrLrlVcpQeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-d5a2f791-e643-488d-bcf2-d6c26a835dff',
                title: 'Ad alta voce del 15/02/2022 - 7. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-15'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=pPpPlussGpPpPlusslYzDbNeH84hDdPssSlashq4ssSlashgeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-da037bf8-594d-4826-abcf-a807df6dc11c',
                title: 'Ad alta voce del 14/02/2022 - 6. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-14'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=hkmp47LFSEoS0CDQDcuU3geeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-70dec201-c92a-4689-aa21-ae05ef3a3814',
                title: 'Ad alta voce del 11/02/2022 - 5. Il paese di Cuccagna di Matilde Serao',
                date: '2022-02-11'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=rSS6mKHyGLzhMgmLixQpXweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-dba623eb-8e05-44d5-ba69-a8d47547e732',
                title: 'Ad alta voce del 10/02/2022 - 4. Il paese di cuccagna di Matilde Serao',
                date: '2022-02-10'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=dSKFMyCJdYqcnLgeAuRfIweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-abcbeed5-80ef-423f-97fe-069bb3310b3c',
                title: 'Ad alta voce del 09/02/2022 - 3. Il paese di cuccagna di Matilde Serao',
                date: '2022-02-09'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=yE4fKGtFmtyL9zl3FlJB2AeeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-e1d1f50e-f02f-4950-b9d8-9a53409d4012',
                title: 'Ad alta voce del 08/02/2022 - 2. Il paese di cuccagna di Matilde Serao',
                date: '2022-02-08'
            },
            {
                mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=kssSlashgGYNG07NaRqZqjNtAInweeqqEEqualeeqqEEqual',
                program: { name: 'dummy', subfolder: 'dummy', url: 'dummy'},
                uniqueName: 'ContentItem-5f4a1266-ac4d-48c9-94af-1f2cf0308d66',
                title: 'Ad alta voce del 07/02/2022 - 1.  Il paese di cuccagna di Matilde Serao',
                date: '2022-02-07'
            }
        ]);
    });

    it('should handle playlists', async () => {
        const program: Program = { name: 'dummy', url: 'dummy', subfolder: 'dummy' };
        const config: Config = {
            programs: [program],
            outputBasePath: 'dummy',
            historyPath: 'dummy',
            tmpDir: 'dummy',
            baseUrl: 'dummybase',
            jquerySelector: 'article > a',
            maxRetries: 0,
            downloadsPerRun: 1,
        };
        (<jest.Mock><unknown>fetch)
            .mockImplementation(url => {
                if (url === 'dummy') {
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
                  program: { name: 'dummy', url: 'dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-1dcb9c9a-5378-4ef3-98ae-64ac9f546735',
                  title: 'Mercè Rodoreda | Il giardino dei fiori blu - 1. Mercè Rodoreda | Il giardino dei fiori blu',
                  date: '2022-03-23'
                },
                {
                  mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=kINacObl4mv5JpinEU7ptweeqqEEqualeeqqEEqual',
                  program: { name: 'dummy', url: 'dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-134a24ab-0dec-4a10-bf48-fa4f6ed71076',
                  title: 'Mercè Rodoreda  | L\'amore fa schifo - 2. Mercè Rodoreda  | L\'amore fa schifo',
                  date: '2022-03-23'
                },
                {
                  mediapolisUrl: 'http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=vssSlashWy8dGoQNSFGMO92dThssSlashAeeqqEEqualeeqqEEqual',
                  program: { name: 'dummy', url: 'dummybase/playlist/mercerodoreda', subfolder: 'dummy' },
                  uniqueName: 'ContentItem-b336bed4-9355-4617-b86f-7780546a82b9',
                  title: 'Mercè Rodoreda | Il bibliobus - 3. Mercè Rodoreda | Il bibliobus',
                  date: '2022-03-23'
                }
              ]);
    });

});