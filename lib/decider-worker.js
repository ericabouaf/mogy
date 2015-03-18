/**
* Default decider process for swf-decider
* This process is spawned for each new decision task received.
* It will look in the working directory for a Node.JS module that has the same name as the workflow
*/
var vm = require('vm'),
    fs = require('fs'),
    path = require('path'),
    swf = require('aws-swf'),
    Q = require('q');


var Mogy = require('../index');

// The task is given to this process as a command line argument in JSON format :
var decisionTaskConfig = JSON.parse(process.argv[2]);

// Re-Create the Decision task
var dt = new swf.DecisionTask(decisionTaskConfig);

function workflowFailed(reason, details) {
    console.log("Sending failed decision: ", reason, details);
    dt.response.fail_workflow_execution(reason, details, function (err) {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Workflow marked as failed ! (decider-worker)");
    });
}


var workflowsDirectory = path.join(process.cwd(), 'deciders');

var workflowName = decisionTaskConfig.workflowType.name;

try {

    var packageJson = JSON.parse(fs.readFileSync(path.join(workflowsDirectory, workflowName, 'package.json') ).toString());
    var workflowDef = packageJson.workflows[workflowName];
    var activities = workflowDef.activities;
    var childworkflows = workflowDef.childworkflows;


    fs.readFile(path.join(workflowsDirectory, workflowName, workflowName + '.js'), function (err, deciderCode) {

        if(err) {
            console.log(err);
            workflowFailed("Error in fetch_code", err);
            return;
        }

        var timerIndex = 1;

        var sandbox = {

            // read content of a file from the decider code
            /*file: function(path) {
                // TODO: fix path relative to decider folder
                return fs.readFileSync(path).toString();
            },*/

            console: console,

            Q: Q,

            workflow_input: function () {
                return dt.eventList.workflow_input();
            },


            timer: function (delay) {

                var deferred = Q.defer();

                var timerId = 'timer-'+timerIndex;

                if(dt.eventList.timer_scheduled(timerId)) {
                    if( dt.eventList.timer_fired(timerId) ) {
                        deferred.resolve();
                    }
                    else {
                        console.log("waiting for timer "+timerId+" to complete");
                    }
                }
                else {
                    console.log("starting timer "+timerId);
                    //dt.response.start_timer(startAttributes, swfAttributes);
                    dt.response.addDecision({
                        "decisionType": "StartTimer",
                        "startTimerDecisionAttributes": {
                            "timerId": timerId,
                            "startToFireTimeout": delay ? String(delay) : "1"
                        }
                    });
                }

                timerIndex++;

                return deferred.promise;
            },

            stop: function (result) {

                var r = result;

                if(typeof r !== 'string') {
                    r = JSON.stringify(r);
                }

                dt.response.addDecision({
                    "decisionType": "CompleteWorkflowExecution",
                    "completeWorkflowExecutionDecisionAttributes": {
                        "result": r
                    }
                });

            }

        };


        var callsByName = {};
        function getActivityId(activityName) {
            var index = callsByName[activityName] || 0;
            index += 1;
            callsByName[activityName] = index;
            return activityName+"_"+index;
        }


        function makeActivityFct(activityName, activityDef) {
            return function(input) {

                var scheduleAttributes = {
                    input: input
                };
                var swfAttributes;

                var deferred = Q.defer();

                var activityId = getActivityId(activityName);

                scheduleAttributes.activity = activityName;
                scheduleAttributes.name = activityId;

                    if( dt.eventList.is_activity_scheduled(activityId) ) {
                        if( dt.eventList.has_activity_completed(activityId) ) {
                            deferred.resolve( dt.eventList.results(activityId) );
                        }
                        else if( dt.eventList.has_schedule_activity_task_failed(activityId) ) {
                            // TODO:
                            workflowFailed("has_schedule_activity_task_failed", "");
                            return;
                        }
                        else if( dt.eventList.has_activity_timedout(activityId) ) {
                            deferred.reject("task timedout");
                        }
                        else if( dt.eventList.has_activity_failed(activityId) ) {
                            deferred.reject("task failed");
                        }
                        else {
                            console.log("waiting for "+activityId+" to complete.");
                            dt.response.wait();
                        }
                    }
                    else {
                        console.log("scheduling "+activityId);
                        dt.response.schedule(scheduleAttributes, swfAttributes);
                    }

                return deferred.promise;
            };
        }

        for(var activityName in activities) {
            sandbox[activityName] = makeActivityFct(activityName, activities[activityName]);
        }



        // CHILDWORKFLOWS methods !

        function makeChildworkflowFct(childworkflowName, childworkflowDef) {
            return function(input) {
                var deferred = Q.defer();

                var control = getActivityId(childworkflowName);
                var startAttributes = {
                    control: control,
                    name: control,
                    workflow: childworkflowDef.workflow || childworkflowName
                };
                var swfAttributes = childworkflowDef.swf || {};


                swfAttributes.input = input;

                if(dt.eventList.childworkflow_scheduled(startAttributes.control)) {
                    if(dt.eventList.childworkflow_completed(control) ) {
                        deferred.resolve( dt.eventList.childworkflow_results(control) );
                    }
                    // TODO
                    /*else if( dt.eventList.childworkflow_timedout(activityId) ) {
                        deferred.reject("childworkflow timedout");
                    }*/
                    else if( dt.eventList.childworkflow_failed(control) ) {
                        deferred.reject("childworkflow failed");
                    }
                    else {
                        console.log("waiting for childworkflow "+" to complete");
                        dt.response.wait();
                    }
                }
                else {
                    console.log("starting childworkflow ", startAttributes);
                    dt.response.start_childworkflow(startAttributes, swfAttributes);
                }

                return deferred.promise;
            };
        }

        if(childworkflows) {
            for(var childworkflowName in childworkflows) {
                var childworkflowDef = childworkflows[childworkflowName];
                sandbox[childworkflowName] = makeChildworkflowFct(childworkflowName, childworkflowDef);
            }
        }




        // Run the decider code
        try {
            vm.runInNewContext(deciderCode, sandbox, workflowName + '.vm');
        } catch (ex) {
            console.log(ex);
            workflowFailed("Error executing workflow decider " + workflowName, "");
        }


        process.nextTick(function () {
            process.nextTick(function () {
            // Send the decisions back to SWF
            if (!dt.response.responseSent) {
                if (dt.response.decisions) {
                    console.log("sending decisions...");

                    dt.response.send(function(err, results) {

                        if (err) {
                            console.error("RespondDecisionTaskCompleted error : ", err, results);
                        }
                        else {
                            console.log(dt.response.decisions.length + " decisions sent !");
                            console.log(JSON.stringify(dt.response.decisions, null, 3));
                        }

                    });
                } else {
                    console.log("No decision sent and no decisions scheduled !");
                    dt.response.fail("Don't know what to do...");
                }
            }

        });
    });


    });

} catch (ex) {
    console.log(ex);
    workflowFailed("Error running the fetch_code method for workflowName : "+workflowName, "");
}
