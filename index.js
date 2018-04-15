/*
* podmanager.js
* (c) Francesco Merletti <me@fm.to.it> @mjs2020
* MIT Licence
*
* Run with:
*     node index.js
*/

// Config vars (change in production)
var downloadDir = __dirname+'/downloads',
  tmpDir = __dirname+'/tmp',
  storageDir = __dirname+'/persist',
  ignorePodcastsOlderThan = 7, // Useful to set for the first run if you don't want to download a huge backlog
  concurrentDownloads = 4;
// Uncomment below for prod
// var downloadDir = '/volume1/music/rita/@@PODCAST',
//   tmpDir = __dirname+'/tmp',
//   storageDir = __dirname+'/persist',
//   ignorePodcastsOlderThan = 365, // Useful to set for the first run if you don't want to download a huge backlog
//   concurrentDownloads = 6;

// Dependencies
var async = require('async'),
  csv = require("basic-csv"),
  moment = require('moment'),
  FeedParser = require('feedparser'),
  request = require('request')
  http = require('http'),
  fs = require('fs'),
  sanitize = require("sanitize-filename"),
  storage = require('node-persist'),
  exec = require('child_process').exec;

// Local vars
var dlCount = 0;

// Load logs to avoid re-downloading the same podcasts
storage.initSync({ dir: storageDir });

// Log start
storage.setItem('lastRun', { time: new Date(), message: 'Started'});

// Clean up tmp dir
exec('rm '+tmpDir+'/*');

// Clean up entries in storage
var currentDate = moment();
storage.forEach(function(key, value) {
  if ((!value || !value.lastSeen || currentDate.diff(moment(value.lastSeen), 'days')>14) && key != 'lastRun' && key != 'lastComplete')  {
    storage.removeItem(key);
  }
});

// Read list of podcast URLs from CSV file, call then and add download jobs into the queue
csv.readCSV(__dirname+'/podcasts.csv', function (err, rows) {
  if (err) return done(err);
  // Remove header row
  rows.shift();
  // For each podcast create a request and a feedparser
  rows.forEach(function (row) {
    var req = request(row[1], {timeout: 120000, pool: false}),
        feedparser = new FeedParser();
    // Configure request
    req.setMaxListeners(50);
    req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36');
    req.setHeader('accept', 'text/html,application/xhtml+xml');
    req.on('error', function (err) {
      console.log('Could not retrieve: '+row[1]);
    });
    req.on('response', function (res) {
      if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
      res.pipe(feedparser);
    });

    // Configure feedparser
    feedparser.on('error', done);
    feedparser.on('end', done);
    feedparser.on('readable', function() {
      var item;
      // Loop through items
      while (item = this.read()) {
        // If the item doesn't have a link skip it
        if (!item.link || item.link == '' ) return;
        // If the pubDate is more than 1 week ago ignore it
        if (moment().diff(moment(item.pubDate),'days')>ignorePodcastsOlderThan) return;
        // Check if we already have the URL in the logs
        storage.getItem(sanitize(item.guid), function (err, value) {
          if (err) return;
          // If we have it, then update the lastSeen attribute
          if (typeof value != 'undefined') {
            value.lastSeen = new Date();
            storage.setItem(sanitize(item.guid), value);
            return;
          }
          // Otherwise add to download queue
          var datestring = moment(item.pubDate).format('YYMMDD');
          downloader.push({
            podcast: row[0],
            filename: datestring+' '+item.title,
            url: item.enclosures[0].url,
            guid: item.guid
          });
        });
      }
    });
  });
});

// Error handler
var done = function (err) {
  if (err) { console.log(err, err.stack); }
}

// Make downloader async queue
var downloader = async.queue(function(task, callback) {
  // Create curl download command and download to tmp dir
  var curl = 'curl -sL -w "%{http_code}" ' + task.url + ' --create-dirs -o "' + tmpDir + '/' + sanitize(task.filename) + '.mp3" ';
  var child = exec(curl, function(err, stdout, stderr) {
    // Handle error
    if (err) {
      console.log('Error downloading: ' + err + stderr);
      callback(err);
      return;
    }
    if (stdout != '200') {
      console.log('HTTP status not 200');
      callback('HTTP status not 200');
      return;
    }
    // Prepare paths
    var tmpPath = tmpDir + '/' + sanitize(task.filename) + '.mp3',
        newPath = downloadDir + '/' + sanitize(task.podcast) + '/' + sanitize(task.filename) + '.mp3';
    // Make destination dir just for safety
    fs.mkdir(downloadDir + '/' + sanitize(task.podcast), function(err) {
      // Then move temp file to destination dir
      fs.rename(tmpPath, newPath, function (err) {
        if (err) {
          console.log('Error moving file: '+err);
          callback(err)
          return;
        }
        dlCount++;
        console.log('['+dlCount+'/'+(dlCount+downloader.length()+downloader.running()-1)+'] Complete: '+sanitize(task.filename)+'.mp3 (' + downloader.length()+' Items left to download)')
        // Add item to storage
        storage.setItem(sanitize(task.guid),{ podcast: task.podcast, lastSeen: new Date(), download: true});
        callback();
      });
    });
  });
}, concurrentDownloads);

downloader.drain = function () {
  storage.getItem('lastComplete', function (err, value) {
    if (typeof value == 'undefined' || !Array.isArray(value)) value = [];
    value.push({ time: new Date(), message: 'Completed '+dlCount+' downloads.'});
    storage.setItem('lastComplete', value);
  });
}
