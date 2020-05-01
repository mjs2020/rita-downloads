const path = require('path');
const fetch = require('node-fetch').default;
const cheerio = require('cheerio');
require("regenerator-runtime/runtime"); // makes async work in babel/webpack
const {readJson, writeJson, writeFile} = require('fs-extra');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:75.0) Gecko/20100101 Firefox/75.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Upgrade-Insecure-Requests': '1'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async function() {
    const {outputBasePath, updatesUrl, historyFile, user, pass} = await readJson(path.join(__dirname, 'config.json'));
    const history = await readJson(path.join(__dirname, historyFile));
    const html = await (await fetch(updatesUrl)).text()
    const $ = cheerio.load(html);

    const downloadIds = $('h3 a')
        .map(function () { return $(this).attr('href')})
        .toArray()
        .map(url => {
            const matches = url && `${url}`.match(/scarica=(\d*)/);
            return matches && matches[1] || null
        })
        .filter(id => !!id);
        
    console.log(`Number of files to dl: ${downloadIds.length}`);
        
    for (let id of downloadIds) {
        console.log(`Fetching details for: ${id} and sleeping for 5 secs`);
        const res = await (await fetch("http://www.bdciechi.it/bib/index.php", {
            headers, method: 'POST', mode: 'cors',
            body: `risperpag=10&catalogo=u&scarica=${id}&mobile=0&username=${user}&pass=${pass}`
        })).text();
        const dlUrl = cheerio.load(res)('a')
            .map(function () { return $(this).attr('href')})
            .toArray()
            .filter(url => /^sys\/bdwget.php/.test(url));
        const url = dlUrl && dlUrl[0] ? `http://www.bdciechi.it/bib/${dlUrl[0]}` : null;
        if (url && !history.includes(url)) {
            console.log(`Downloading from ${url}`);
            const res = await fetch(url);
            const filename = res.headers.get('Content-Disposition').match(/attachment; filename="(.*)"/)[1];
            const txt = await res.text();
            await writeFile(`${outputBasePath}/${filename}`, txt);
            history.push(url);
        }
        console.log('Sleeping 5secs');
        await delay(5000);
    }

    await writeJson(path.join(__dirname, historyFile), history);
  }());