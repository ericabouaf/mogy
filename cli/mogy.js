#!/usr/bin/env node

var path = require('path');

var Mogy = require( path.join(__dirname, '..', 'index') );

var argv = require('minimist')(process.argv.slice(2));

Mogy.cli(argv);
