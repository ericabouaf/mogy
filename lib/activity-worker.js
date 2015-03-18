/**
 * Worker process for swf-activity
 * This process is spawned for each new activity task received.
 * It will look in the working directory for a Node.JS module that has the same name as the activity-type
 *
 * The strategy to try to load the activities is the following :
 *  1. Try to find the module locally (a folder named after the activity named)
 *  2. Try to find the module in the dependencies (a folder named node_modules/mogy-* )
 *
 * Load the worker module
 *  Simple module : 'soap' -> require('soap').worker
 *  or multiple activities package: 'ec2_runInstances' -> require('ec2').runInstances
 */

var path = require('path'),
    fs = require('fs'),
    swf = require('aws-swf');

// The task is given to this process as a command line argument in JSON format :
var taskConfig = JSON.parse(process.argv[2]);

var Mogy = require('../index');

// Create the ActivityTask
var task = new swf.ActivityTask(taskConfig);

function activityFailed(reason, details) {

    if(typeof reason != "string") reason = JSON.stringify(reason);

    task.respondFailed(reason, details, function (err) {
        if (err) { console.error(err); return; }
        console.log("respond failed !");
    });
}


var activityName = taskConfig.activityType.name;

var split = activityName.split('_');

var moduleName = split[0],
    methodName = moduleName; //"worker";

if(split.length > 1) {
    methodName = split[1];
}


var localModulePath = path.join(process.cwd(), 'activities', moduleName);
var dependencyModulePath = path.join(process.cwd(), 'node_modules', 'mogy-'+moduleName);

var modulePath;
if( fs.existsSync(localModulePath) ) {
    modulePath = localModulePath;
}
else if( fs.existsSync(dependencyModulePath) ) {
    modulePath = dependencyModulePath;
}
else {
    var err = "Module '"+moduleName+"' not found !";
    console.log(err);
    activityFailed(err);
    process.exit(1);
}


console.log("Module: ", moduleName, "Method Name: ", methodName, "path: ", modulePath);

try {
    console.log("Trying to load activity module : " + moduleName);
    var activityModule = require(modulePath);
    console.log("module loaded !");

    var method = activityModule[methodName];
    if(!method) {
        throw new Error('No method "'+methodName+'" for module '+moduleName);
    }

} catch (ex) {
    console.log(ex);
    activityFailed("Unable to load module " + workerName, "");
}


var config = Mogy.config.activities[moduleName];

try {

    var input = task.config.input;
    try {
        input = JSON.parse(input);
    }
    catch(ex) {}

    method(input, config, function (err, results) {
        if(err) {
            console.log(err);
            activityFailed(err, JSON.stringify(results) );
            return;
        }
        task.respondCompleted(results);
    }, task.config.taskToken);
} catch (ex) {
    console.log(ex);
    activityFailed("Error executing " + activityName, "");
}
