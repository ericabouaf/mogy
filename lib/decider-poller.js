#!/usr/bin/env node

// Start a DeciderPoller which spawns decider-worker.js for each new decisionTask

var Mogy = require('../index');

var workerConfig = Mogy.config.deciders;

var colors = require('colors'),
    spawn = require('child_process').spawn,
    path = require('path'),
    swf = require('aws-swf');


// Start a decider poller
var myDecider = new swf.Decider({
    domain: Mogy.config.aws.swf.domain,
    taskList: {"name": workerConfig.tasklist},
    identity: workerConfig.identity,
    maximumPageSize: 500,
    reverseOrder: false // IMPORTANT: must replay events in the right order, ie. from the start
});


myDecider.on('decisionTask', function (decisionTask) {

    // If we receive an event "ScheduleActivityTaskFailed", we should fail the workflow and display why...
    var failedEvent = decisionTask.eventList.has_schedule_activity_task_failed();
    if (failedEvent) {
        var failedAttrs = failedEvent.scheduleActivityTaskFailedEventAttributes;
        console.error(("Received a ScheduleActivityTaskFailed: " + failedAttrs.cause + "  " + JSON.stringify(failedAttrs)).red);
        decisionTask.fail_workflow_execution(failedAttrs.cause, JSON.stringify(failedAttrs), function (err, results) {

            if (err) {
                console.log(err, results);
                return;
            }
            console.error("Workflow marked as failed !".red);
        });
        return;
    }

    console.log("new decisionTask received ! spawning...");

    // Spawn child process
    var p = spawn('node', [ path.join(__dirname, 'decider-worker.js'), JSON.stringify(decisionTask.config) ]);

    p.stdout.on('data', function (data) {
        console.log(data.toString().blue);
    });

    p.stderr.on('data', function (data) {
        console.log(data.toString().red);
    });

    p.on('exit', function (code) {
        console.log(('child process exited with code ' + code));

        myDecider.poll();
    });

});


myDecider.on('poll', function(d) {
    console.log("["+d.identity+"] polling for decision tasks on '"+d.taskList.name+"'...");
});

myDecider.start();

// on SIGINT event, close the poller properly
process.on('SIGINT', function () {
    console.log('Got SIGINT ! Stopping decider poller after this request...please wait...');
    myDecider.stop();
});
