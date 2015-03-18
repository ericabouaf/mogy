
var colors = require('colors'),
    path = require('path'),
    swf = require('aws-swf');


var d = {

    workflow: function (wfName, input, Mogy) {

        console.log("Starting workflow "+wfName);


        /**
         * TODO: we should look for the default configuration in the decider package !
         */

        var workflow = new swf.Workflow({
            "domain": Mogy.config.aws.swf.domain,
            "workflowType": {
                "name": wfName,
                "version": '1.0' // TODO
            },
            "taskList": { "name": 'aws-swf-tasklist' }, // TODO

            "executionStartToCloseTimeout": '1800', // 30 minutes TODO
            "taskStartToCloseTimeout": '1800', // 30 minutes TODO
            "childPolicy": 'TERMINATE', // TODO

            //"workflowId": argv.workflowId,

            "tagList": []// argv.tag ? (Array.isArray(argv.tag) ? argv.tag : [argv.tag]) : []
        });

        function startWorkflowExecution() {

            workflow.start({ input: input || "" }, function (err, runId) {

                if (err) {
                    console.error(("Error starting workflow '" + wfName + "'").red);
                    console.error(err);


                    // Auto-registration of workflows
                    // TODO: add this 'auto-registration' feature as an option to the workflow.start method
                    if(err.code == "UnknownResourceFault") {

                        console.log("Workflow not registered ! Registering...");
                        workflow.register(function (err, results) {

                            if (err) {
                                console.error(("Error registering the workflow !").red);
                                console.error(err);
                                process.exit(1);
                            }

                            console.log("Workflow registered ! Starting...");
                            startWorkflowExecution();

                        });

                    } else {
                        process.exit(1);
                    }
                    return;
                }

                console.log("Workflow started, runId: " + runId, input);

            });

        }

        startWorkflowExecution();


    }

};


function start(argv) {

    if(argv._.length === 0) {
        console.log("Missing workflow name !");
        process.exit(1);
    }

    var wfName = argv._[0];

    var input;
    if(argv._.length > 1) {
        input = argv._[1];

        try {
            input = JSON.parse(input);
        }
        catch(ex) {}
    }

    d.workflow(wfName, input, this);

}

module.exports = start;
