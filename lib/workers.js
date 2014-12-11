
var path = require('path');
var fork = require('child_process').fork;


function startDeciderPoller() {
    fork( path.join(__dirname, 'decider-poller.js') , []);
}

function startActivityPoller() {
    fork( path.join(__dirname, 'activity-poller.js') , []);
}

module.exports = function (cmd, argv) {

    if(cmd === 'workers') {
        startDeciderPoller();
        startActivityPoller();
    }
    else if(cmd === 'decider') {
        startDeciderPoller();
    }
    else if(cmd === 'activity') {
        startActivityPoller();
    }

};
