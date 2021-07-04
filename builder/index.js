const _ = require('lodash');
const fp = require('lodash/fp');
const axois = require('axios');

const rootUrl = 'https://raw.githubusercontent.com/cmtr/cms-public/main/content/index.json';

// Helpers
const resolve = (func) => (promise) => promise.then(func);
const peek = (obj) => {
	console.log(obj);
	return obj;
}

// Predicates
const isObject = (obj) => typeof obj === 'object' && obj !== null;
const isArray = Array.isArray;
const isType = (type) => (obj) => isObject(obj) && obj.type && obj.type === type;

// Get Data
const getJson = (url) => axois
	.get(url)
	.then(fp.get('data'));

const reduceEntriesToObject = (obj={}) => (arr) => arr
	.reduce((acc, [key, value]) => _.set(acc, key, value), obj);

const getSubtree = async (obj) => isType('map')(obj)
		? getJson(obj.source)
		: obj;

const traverseThree = (func) => async (obj) => Promise
	.all(Object
		.entries(obj)
		.map(([key, val]) => func(val)
				.then(res => {
					if (isObject(val)) 
						return traverseThree(func)(res)
							.then((data) => [key, data]);
					if (isArray(val))
						return Promise
							.all(res.map(traverseThree(func)))
							.then((res) => [key, res]);
					return [key, res]
				})))
	.then(reduceEntriesToObject(obj))


const build = fp.flow(
	getJson,
	resolve(traverseThree(getSubtree)),
//	resolve(async (data) => _.get(data, 'about.team.team')),
	resolve(console.log)
);

const root = build(rootUrl);


	