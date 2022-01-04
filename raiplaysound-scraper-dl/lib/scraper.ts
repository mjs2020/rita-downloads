const request = require('request-promise');
const cheerio = require('cheerio');

const log = require('./logger');

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const regex = new RegExp(urlRegex);

export default function (program: { name: any; url: any; }, config: { jquerySectionSelector: any; }) {
    log(`${program.name} - Requesting page`);
    return request(program.url)
        .then(html => {
            const $ = cheerio.load(html);
            const sections = $(config.jquerySectionSelector);
            if (sections.length) {
                log(`${program.name} - has ${sections.length} subsections`);
                return Promise.all(sections.map((i,section) => request(`http://www.raiplayradio.it/${$(section).attr('href')}`).then(html => {
                    const $ = cheerio.load(html);
                    return getEpisodes($, config, program);
                })).get())
                .then(results => results.reduce((flattened, result) => flattened.concat(result), []));
            } else {
                return getEpisodes($, config, program);
            }
        })
        .then(episodes => {
            log(`${program.name} - Got response with ${episodes.length} episodes`);
            return episodes;
        })
        .catch(err => {
            console.error(`${program.name} - Error fetching episodes: ${err}`);
            return [];
        })
}

function getEpisodes ($, config, program) {
    const episodes = $(config.jquerySelector);
    return episodes.map((i,episode) => ({
        mediapolisUrl: $(episode).attr('data-mediapolis'),
        program: program,
        uniqueName: $(episode).attr('data-uniquename'),
        title: $(episode).find('h3').text(),
        date: $(episode).find('span.canale').text()
    }))
    // episodes is a cheerio array so we need to run get() to get the actual results of the map
    .get()
    // filter out any episodes we did not get a mediapolis url for
    .filter(episode => episode.mediapolisUrl && episode.mediapolisUrl.match(regex));
}