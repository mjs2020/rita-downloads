import moment from 'moment';
import fs from 'fs';

var stream = fs.createWriteStream("log.txt", {flags:'a'});

// Writes to console and to local log file
export default function (message: string) {
    const logline = moment().format('DD/MM/YY, HH:mm:ss')+' - '+message;
    console.log(logline);
    stream.write(logline + "\n");
}