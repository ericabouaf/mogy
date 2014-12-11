

var Mogy = {};

Mogy.config = require('./lib/config');

Mogy.start = require('./lib/start');
Mogy.register = require('./lib/register');
Mogy.workers = require('./lib/workers');


Mogy.cli = require('./lib/cli');

module.exports = Mogy;
