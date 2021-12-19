const fs = require('fs');
const { promisify } = require('util');
const _ = require('lodash');
const fp = require('lodash/fp');
const axois = require('axios');
const marked = require('marked');

const rootUrl = 'https://raw.githubusercontent.com/cmtr/cms-public/main/content/index.json';
const github = {
	rootUrl: 'https://raw.githubusercontent.com/cmtr/cms-public/main/content/',
	user: 'cmtr',
	repository: 'cms-public',
	branch: 'main'
};

const githubRoot = 'https://raw.githubusercontent.com/cmtr/cms-public/main/content/';
const fileRoot = '/home/harald/Workspace/cms-public/content/';
const index = 'index.json';



// Helpers
const resolve = (func) => (promise) => promise.then(func).catch(console.log);
const resolveIfNotFirst = (func, i) => i > 0 ? resolve(func) : func;
const promiseFlow = (...args) => fp.flow(args.map(resolveIfNotFirst));
const peek = (obj) => {
	console.log(obj);
	console.log(obj.about.image);
	return obj;
};

// Predicates
const isObject = (obj) => typeof obj === 'object' && obj !== null;
const isArray = Array.isArray;
const isType = (type) => (obj) => isObject(obj) && obj.type && obj.type === type;
const isUrlRegExp = new RegExp('^(https?:\\/\\/)?'+ // protocol
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
		'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
		'(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
		'(\\#[-a-z\\d_]*)?$','i'); // fragment locator
const isURL = isUrlRegExp.test;


// Get Data
const getFromUrl = (url) => axois
	.get(url)
	.then(fp.get('data'));

const getFromFile = (file) => promisify(fs.readFile)(file, 'utf-8');

const getJson = (root) => (path) => isURL(root) 
	? getFromUrl(root + path)
	: getFromFile(root + path)
		.then(JSON.parse);

const getData = (root) => (path) => isURL(root) 
	? getFromUrl(root + path)
	: getFromFile(root + path); 

// Tree Builder
const reduceEntriesToObject = (obj={}) => (arr) => arr
	.reduce((acc, [key, value]) => _.set(acc, key, value), obj);

const getSubtree = (root) => async (obj) => isType('map')(obj)
	? getJson(root)(obj.source)
		.catch((err) => {
			console.log(obj);
			console.log(err);
		})
	: obj;

const traverseThree = (func) => async (obj) => Promise
	.all(Object
		.entries(obj)
		.map(([key, val]) => func(val)
			.then(res => {
				if (isObject(val)) return traverseThree(func)(res)
					.then((data) => [key, data]);
				if (isArray(val)) return Promise
					.all(res.map(traverseThree(func)))
					.then((res) => [key, res]);
				return [key, res];
			})))
	.then(reduceEntriesToObject(obj));


const updateExternalField = (root) => async (obj) => isType('external-field')(obj)
	? getData(root)(obj.source)
		.then((val) => _.set(obj, obj.target, val))
	: obj;


const updateReference = async (tree) => {
	const update = async (obj) => isType('ref')(obj)
		? _.get(tree, obj.source)
		: obj;
	return traverseThree(update)(tree);
};



const arrayToObject = (path, key) => async (obj) => {
	const updated = fp.flow(
		fp.get(path),
		fp.map((val) => [val[key], val]),
		reduceEntriesToObject({}),
	)(obj);	
	return _.set(obj, path, updated);
};


const build = (root) => promiseFlow(
	getJson(root),
	traverseThree(getSubtree(root)),
	traverseThree(updateExternalField(root)),
	arrayToObject('images.stockImages', 'id'),
	arrayToObject('images.assets', 'id'),
	arrayToObject('about.aboutContent', 'id'),
	arrayToObject('about.team.team', 'id'),
	arrayToObject('services.serviceContent', 'id'),
//	arrayToObject('services.features', 'id'),
	updateReference,
	fp.set('marked', marked),
	fp.set('_', _),
	fp.set('navVersion', 'full'),
	arrayToObject('publications.publications', 'id'),
	peek
);

	
// Create Singleton Data object
let data = undefined;


// Middleware Function - Add data to request
module.exports = function(req, res, next) {
	const proceed = (result) => {
		if (result !== undefined)
			data = result;
		req.all = data;
		next();
	};

	if (false) proceed();			
	else build(fileRoot)(index)
		.then(proceed);
};