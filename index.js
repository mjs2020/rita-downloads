/*
* 
* Run with node index.js
*/

// Config vars
var downloadDir = __dirname+'/downloads',
  tmpDir = __dirname+'/tmp',
  storageDir = __dirname+'/persist',
  ignorePodcastsOlderThan = 7, // Useful to set for the first run if you don't want to download a huge backlog
  concurrentDownloads = 4;

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

// Read list of podcast URLs from CSV file, call then and add download jobs into the queue
csv.readCSV(__dirname+'/podcasts.csv', function (err, rows) {
  var done = function (err) {
    if (err) { console.log(err, err.stack); }
  }
  if (err) done(err);
  rows.shift(); // Remove header row
  rows.forEach(function (row) {
    // For each podcast create a request and a feedparser
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
        storage.getItem(sanitize(item.link), function (err, value) {
          if (err) return;
          // If we have it, then update the lastSeen attribute
          if (typeof value != 'undefined') {
            value.lastSeen = new Date();
            storage.setItem(sanitize(item.link), value);
            return;
          }
          // Otherwise add to download queue
          var datestring = moment(item.pubDate).format('YYMMDD');
          downloader.push({
            podcast: row[0],
            filename: datestring+' '+item.title,
            url: item.enclosures[0].url
          });        
        });        
      }
      // Then clean up old entries (any entries not seen in RSSes for over two weeks)
      var currentDate = moment();
      storage.forEach(function(key, value) {
        if ((!value || !value.lastSeen || currentDate.diff(moment(value.lastSeen), 'days')>14) && key != 'lastRun' && key != 'lastComplete')  {
          storage.removeItem(sanitize(key));
        }
      });
    });
  });
});

// Make downloader async queue
var downloader = async.queue(function(task, callback) {
  // Create curl download command and download to tmp dir
  var curl = 'curl -L ' + task.url + ' --create-dirs -o "' + tmpDir + '/' + sanitize(task.filename) + '.mp3" ';
  var child = exec(curl, function(err, stdout, stderr) {
    // Handle error
    if (err) {
      console.log('Error downloading: ' + err + stderr);
      callback(err);
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
          console.log(err);
          callback(err)
          return;
        }
        dlCount++;
        console.log('['+dlCount+'/'+(dlCount+downloader.length()+downloader.running())+'] Complete: '+sanitize(task.filename)+'.mp3 (' + downloader.length()+' Items left to download)')
        // Add item to storage
        storage.setItem(sanitize(task.url),{ podcast: task.podcast, lastSeen: new Date(), download: true});
        callback();
      });
    });
  });
}, concurrentDownloads);
downloader.drain = function () {
  storage.setItem('lastComplete', { time: new Date(), message: 'Completed '+dlCount+' downloads.'});
}
