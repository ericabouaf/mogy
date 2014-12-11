
var colors = require('colors'),
    path = require('path'),
    fs = require('fs'),
    async = require('async'),
    swf = require('aws-swf');



module.exports = function (argv) {

    var Mogy = this;

    var swfClient = swf.createClient();


    var registerWorkflows = function (toRegister) {

        var registerAT = function (a, callback) {

            var version = "1.0"; // TODO

            console.log("registering Workflow : ", a, version);

            swfClient.registerWorkflowType({
                domain: Mogy.config.aws.swf.domain,
                name: a,
                version: version
            }, function (err, results) {
                if (err) {
                    console.log("err: ", err);
                }
                //console.log("RegisterActivityType results: ", results);
                callback();
            });
        };

        async.map(toRegister, registerAT, function (err) {
            if (err) {
                console.log(err);
            }
        });

    };


    var registerMissingWorkflows = function (workflowsToRegister) {

        var version = "1.0";

        swfClient.listWorkflowTypes({
            domain: Mogy.config.aws.swf.domain,
            registrationStatus: "REGISTERED",
            maximumPageSize: 500
        }, function (err, registeredWorkflows) {
            if (err) {
                console.log("error", err);
                return;
            }

            registeredWorkflows = registeredWorkflows.typeInfos.map(function (w) {
                return w.workflowType.name + '-v' + w.workflowType.version;
            });

            var toRegister = [];

            workflowsToRegister.forEach(function (a) {
                if (registeredWorkflows.indexOf(a + '-v' + version) === -1) {
                    console.log("Workflow " + a + " not registered yet !");
                    toRegister.push(a);
                } else {
                    console.log("Workflow " + a + " already registered !");
                }
            });

            if (toRegister.length > 0) {
                registerWorkflows(toRegister);
            }

        });

    };


    var registerActivityTypes = function (toRegister) {

        var registerAT = function (a, callback) {

            var version = "1.0"; // TODO

            console.log("registering ActivityType : ", a, version);
            swfClient.registerActivityType({
                domain: Mogy.config.aws.swf.domain,
                name: a,
                version: version
            }, function (err, results) {
                if (err) {
                    console.log("err: ", err);
                }
                //console.log("RegisterActivityType results: ", results);
                callback();
            });
        };

        async.map(toRegister, registerAT, function (err) {
            if (err) {
                console.log(err);
            }
        });

    };

    var registerMissingActivityTypes = function (activityTypesToRegister) {

        var version = "1.0";

        var registeredActivityTypes = [];

        var nextPageToken;

        async.doWhilst(function (callback) {
            console.log("Querying activity type...");
            swfClient.listActivityTypes({
                domain: Mogy.config.aws.swf.domain,
                registrationStatus: "REGISTERED",
                //maximumPageSize: 100,
                nextPageToken: nextPageToken
            }, function (err, response) {
                nextPageToken = response.nextPageToken;
                registeredActivityTypes = registeredActivityTypes.concat(response.typeInfos);
                callback(err);
            });

        }, function () {
            return !!nextPageToken;
        }, function (err) {
            if (err) {
                console.log("error", err);
                return;
            }

            registeredActivityTypes = registeredActivityTypes.map(function (w) {
                return w.activityType.name + '-v' + w.activityType.version;
            });

            var toRegister = [];

            activityTypesToRegister.forEach(function (a) {
                if (registeredActivityTypes.indexOf(a + '-v' + version) === -1) {
                    console.log("ActivityType " + a + " not registered yet !");
                    toRegister.push(a);
                } else {
                    console.log("ActivityType " + a + " already registered !");
                }
            });

            if (toRegister.length > 0) {
                registerActivityTypes(toRegister);
            }

        });

    };

    //
    // Register everything within the current working directory
    //

    var activityTypesToRegister = [];


    function findActivitiesIn(folder) {
        fs.readdirSync(folder).forEach(function (file) {
            var f = path.join(folder, file);

            if(fs.statSync(f).isDirectory()) {
                //console.log(f);
                var packageFile = path.join(folder, file, 'package.json');

                if( fs.existsSync(packageFile) ) {
                    var p = JSON.parse(fs.readFileSync(packageFile));
                    //console.log(p);
                    if(p.activities) {
                        for(var activityName in p.activities) {
                            console.log(activityName);
                            activityTypesToRegister.push(activityName);
                        }
                    }
                }
            }

        });
    }

    findActivitiesIn(path.join(Mogy.config.root, 'activities'));
    findActivitiesIn(path.join(Mogy.config.root, 'node_modules'));




    var workflowsToRegister = [];
    function findWorkflowsIn(folder) {
        fs.readdirSync(folder).forEach(function (file) {
            var f = path.join(folder, file);

            if(fs.statSync(f).isDirectory()) {
                //console.log(f);
                var packageFile = path.join(folder, file, 'package.json');

                if( fs.existsSync(packageFile) ) {
                    var p = JSON.parse(fs.readFileSync(packageFile));
                    //console.log(p);
                    if(p.workflows) {
                        for(var workflowName in p.workflows) {
                            console.log(workflowName);
                            workflowsToRegister.push(workflowName);
                        }
                    }
                }
            }

        });
    }

    findWorkflowsIn(path.join(Mogy.config.root, 'deciders'));
    findWorkflowsIn(path.join(Mogy.config.root, 'node_modules'));


    if (workflowsToRegister.length > 0) {
        registerMissingWorkflows(workflowsToRegister);
    }

    if (activityTypesToRegister.length > 0) {
        registerMissingActivityTypes(activityTypesToRegister);
    }

};
