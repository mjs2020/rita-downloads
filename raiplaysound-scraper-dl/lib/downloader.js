const fs = require('fs-extra');
const moment = require('moment');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const url = require('url');
const sanitize = require("sanitize-filename");
var exec = require('child-process-promise').exec;

const log = require('./logger');

module.exports = function (episode, tmpDir, outputBasePath) {
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
    return exec(curlCmd)
        .then(result => {
            const { stdout, stderr } = result;
            if (stderr) throw new Error(stderr);
            if (stdout !== '200') throw new Error(stdout);
        })
        // ensure destination directory exists
        .then(() => fs.ensureDir(destPath))
        // move from tmpDir to destination
        .then(() => fs.move(`${tmpDir}/${filename}`, `${destPath}/${filename}`, { overwrite: true }))
        .then(() => {
            log(`${episode.program.name} - Successfully downloaded episode to ${destPath}/${filename}`);
            episode.successful = true;
            return episode;
        })
        .catch(err => {
            console.error(`${episode.program.name} - Failed to download episode to ${destPath}/${filename} Error was ${err}`);
            episode.successful = false;
            return episode;
        });
}