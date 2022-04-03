import { DownloadResult, Episode } from "../types";
import moment from 'moment';
import sanitize from "sanitize-filename";
import log from './logger';

const {promisify} = require('util');
const fs = require('fs');
const ensureDirAsync = promisify(fs.ensureDir);
const moveAsync = promisify(fs.move);
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const exec = require('child-process-promise').exec;

export default async function (episode: Episode, tmpDir: string, outputBasePath: string): Promise<DownloadResult> {
    const dateString = moment(episode.date, 'DD/MM/YYYY').format('YYMMDD');
    const destPath = `${outputBasePath}/${sanitize(episode.program.subfolder)}`;
    const filename = `${dateString} - ${sanitize(entities.decode(episode.title))}.mp3`
    log(`${episode.program.name} - Starting download from ${episode.mediapolisUrl} to ${destPath}/${filename}`);
    // download with curl to tmpPath and then move to destPath
    const curlOpts = [
        `'${episode.mediapolisUrl}'`,
        `-sL`,
        `-w "%{http_code}"`,
        `-H "Cache-Control: no-cache"`,
        `-H 'DNT: 1'`,
        `-H 'Accept-Encoding: gzip, deflate'`,
        `-H 'Accept-Language: en-GB,en;q=0.9,en-US;q=0.8,it;q=0.7'`,
        `-H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'`,
        `-H 'Upgrade-Insecure-Requests: 1'`,
        `-H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'`,
        `--compressed`,
        `--create-dirs`,
        `-o "${tmpDir}/${filename}"`
    ]
    const curlCmd = `curl ${curlOpts.join(' ')}`;

    try {
        const { stdout, stderr } = await exec(curlCmd);
        if (stderr) throw new Error(stderr);
        if (stdout !== '200') throw new Error(stdout);
        await ensureDirAsync(destPath);
        await moveAsync(`${tmpDir}/${filename}`, `${destPath}/${filename}`, { overwrite: true });
        log(`${episode.program.name} - Successfully downloaded episode to ${destPath}/${filename}`);
        return { successful: true, episode };
    } catch (err) {
        console.error(`${episode.program.name} - Failed to download episode to ${destPath}/${filename} Error was ${err}`);
        return { successful: false, episode };
    }
}