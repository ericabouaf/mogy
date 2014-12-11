

function showHelp() {
    console.log("Usage: mogy [cmd action]");
}

module.exports = function (argv) {

    if(argv._.length === 0) {
        showHelp();
        process.exit(0);
    }

    var cmd = argv._[0];
    argv._.shift();


    if(cmd === 'start') {
        this.start(argv);
    }
    else if(cmd === 'register') {
        this.register(argv);
    }
    else if(cmd === 'workers' || cmd === 'decider' || cmd === 'activity') {
        this.workers(cmd, argv);
    }
    else {
        console.log('Unknown mogy cmd "'+cmd+'" ');
        showHelp();
        process.exit(1);
    }

};
