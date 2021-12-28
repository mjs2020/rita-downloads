# RaiPlayRadio-scraper-downloader

This is a simple node script designed to run on a synology NAS to automatically scrape raiplayradio.it for new episodes of configured programs and download them.

## Usage

1. Create the `config.json` file
2. Set the absolute path to it in `index.js`
3. Run with `node index.js`

## Deploy to diskstation

Run `npm run build` and copy `build/bundle.js` to the diskstation.

## Running as a cron task on a Synology DSM

The script was originally written to run automatically on a Synology Disk Station.
To get it running as a cron job I first installed NodeJS from the package center in
the disk station's web interface and then set up a cron job from Control Panel -> 
Task Scheduler. Node is located at /volume1/@appstore/Node.js/usr/bin/node so the job
had the following User-defined Script:

    /volume1/@appstore/Node.js/usr/bin/node /volume1/your/path/to/index.js