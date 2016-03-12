'use strict';
// Author: tngan
//
// TODO Find an online database server (use question_id as the key)
// TODO Think about handling time-series data
// TODO Filter unused data
// TODO Add the fetching timestamp (For another interesting questions in weekly/festival bias)

//Sample code to use parser
//parser(res.body.items, 'questions');

const query = require('./lib/query');
const parser = require('./lib/parser');
const converter = require('./lib/json2csv');
const time = require('./lib/timeConverter');
const _ = require('lodash');
const fs = require('fs');


let questions = [];
let page = 1;
let pagePerFile = 50;
// Generic generator
// Get all questions in 2014


var config;
fs.readFile('./config.json', 'utf8', (err, data) => {
	if(err) throw err;
	config = JSON.parse(data);
});

const tag = config.tag;
const toDate = config.to;
const isChainDate = _.isDate(config.from) && _.isDate(config.to);

function * genericQueryGenerator() { 
    
	const basicQuery = query('questions').sort('creation').tagged(tag).pageSize('100'); // 2014-02-01 to 2014-02-28
    while(true) {
        // TODO Abstract it out later on
        console.log(`Fetching page ${startPage} ...`);
		basicQuery = basicQuery.page(startPage++);
		if (isChainDate) {
			yield basicQuery.fromDate(config.from).toDate(config.to);
		} else {
			yield basicQuery;
		}
    }
}

const questionQueryGenerator = new genericQueryGenerator();

function queryQuestions() {
    return new Promise(function(resolve, reject) {
        questionQueryGenerator.next().value.exec((err, res) => {
            if(res.body.error_id) {
                // Reject this promise
                reject(res.body.error_message);
            } else {
                // Promise only accept one value, has_more determines whether next page is needed to be fetched
                // You can get the json for current page using
                // parser(res.body.items, 'questions')
                questions = questions.concat(parser(res.body.items, 'questions'));
                resolve(res.body.has_more);
            }
        });
    });
}

Promise.resolve(true)
    .then(function loop(hasMore) {
        if(page++ % pagePerFile === 0 || !hasMore) {
            converter.convert(questions.slice(0), './raw', (err, path) => {
                if(err) {
                    console.log('Error', err);
                } else {
                    console.log(`See the .csv file in under ./raw for page ${page - pagePerFile} - ${ page - 1 }`);
                }
            });
            questions = []; // Restore
        }
        if(hasMore) {
            return queryQuestions().then(loop);
        }
    })
.then(function() {
    console.log('Done ...');
})
.catch(function(e) {
    console.log('error', e);
    if(questions.length >0){
        console.log('Attempt dumping remaining data');
        converter.convert(questions.slice(0), './raw', (err, path) => {
            if(err) {
                console.log('Error', err);
            } else {
                console.log(`See the .csv file in under ./raw for page ${page - pagePerFile} - ${ page - 1 }`);
            }
        });
    }
});
