var path = require('path');
var swf = require('aws-swf');

/**
* Configuration
*/
var config = {
    "env": process.env.NODE_ENV || 'development',
    "root": process.cwd()
};

var env_config = require( path.join(config.root, 'config', 'environments', config.env) );
for(var k in env_config) {
    config[k] = env_config[k];
}


swf.AWS.config.update({region: config.aws.region});


module.exports = config;
