#!/usr/bin/env node

// Start a ActivityPoller which spawns the given activity worker file

var Mogy = require('../index');

var workerConfig = Mogy.config.activities;

var colors = require('colors'),
    spawn = require('child_process').spawn,
    path = require('path'),
    swf = require('aws-swf');



// Start the activity poller
var activityPoller = new swf.ActivityPoller({
    domain: Mogy.config.aws.swf.domain,
    taskList: {name: workerConfig.tasklist},
    identity: workerConfig.identity
});


activityPoller.on('activityTask', function (activityTask) {

    // Spawn child process
    var p = spawn('node', [ path.join(__dirname, 'activity-worker.js'), JSON.stringify(activityTask.config) ]);

    p.stdout.on('data', function (data) {
        console.log(data.toString().blue);
    });

    p.stderr.on('data', function (data) {
        console.log(data.toString().red);
    });

    p.on('exit', function (code) {
        console.log('child process exited with code ' + code);
    });

});


activityPoller.on('poll', function(d) {
    console.log("["+d.identity+"] polling for activity tasks on '"+d.taskList.name+"'...");
});

activityPoller.start();

// on SIGINT event, close the poller properly
process.on('SIGINT', function () {
    console.log('Got SIGINT ! Stopping activity poller after this request...please wait...');
    activityPoller.stop();
});
