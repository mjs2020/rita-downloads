## Intro

This is a simple command line script that reads a list of podcast URLs from a CSV file,
calls the podcasts and downloads them. Folder paths can be configured in the script.

It was written to be run with cron.

## Installation

   1. Clone the repo or download a zip
   1. Go in the folder and run ```npm install```
   1. Rename and edit ```podcasts.csv.example```
   1. Open ```index.js``` and edit the config vars
   1. Run script with ```node index.js```

## Running as a cron task on a Synology DSM

The script was originally written to run automatically on a Synology Disk Station.
To get it running as a cron job I first installed NodeJS from the package center in
the disk station's web interface and then set up a cron job from Control Panel -> 
Task Scheduler. Node is located at /volume1/@appstore/Node.js/usr/bin/node so the job
had the following User-defined Script:

    /volume1/@appstore/Node.js/usr/bin/node /volume1/your/path/to/podmanager.js/index.js