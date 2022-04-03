import { DownloadResult, Episode } from "../types";
import moment from 'moment';
import sanitize from "sanitize-filename";
import log from './logger';
import path from 'path';

const {promisify} = require('util');
const fs = require('fs');
const accessAsync = promisify(fs.access);
const renameAsync = promisify(fs.rename);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const exec = require('child-process-promise').exec;

export default async function (episode: Episode, tmpDir: string, outputBasePath: string): Promise<DownloadResult> {
    const dateString = moment(episode.date).format('YYMMDD');
    const destPath = path.join(outputBasePath, sanitize(episode.program.subfolder));
    if (!await existsAsync(destPath)){
        await mkdirAsync(destPath, { recursive: true });
    }
    const filename = `${dateString} - ${sanitize(entities.decode(episode.title))}.mp3`
    log(`${episode.program.name} - Starting download to ${filename}`);
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
        await accessAsync(destPath, fs.constants.W_OK);
        await renameAsync(`${tmpDir}/${filename}`, `${destPath}/${filename}`);
        log(`${episode.program.name} - Successfully downloaded episode to ${filename}`);
        return { successful: true, episode };
    } catch (err) {
        console.error(`${episode.program.name} - Failed to download episode from ${episode.mediapolisUrl}  to ${filename}.`);
        console.error(`Error was ${err}`);
        return { successful: false, episode };
    }
}