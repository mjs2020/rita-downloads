const moment = require('moment');

module.exports = function (message) {
    console.log(moment().format('DD/MM/YY, HH:mm:ss')+' - '+message)
}