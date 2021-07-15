const fs = require('fs');
const { promisify } = require('util');
const _ = require('lodash');
const fp = require('lodash/fp');
const axois = require('axios');

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
const peek = (obj) => {
	console.log(obj);
	return obj;
};

// Predicates
const isObject = (obj) => typeof obj === 'object' && obj !== null;
const isArray = Array.isArray;
const isType = (type) => (obj) => isObject(obj) && obj.type && obj.type === type;
const isURL = (str) => {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return pattern.test(str);
}


// Get Data
const getFromUrl = (url) => axois
	.get(url)
	.then(fp.get('data'));

const getFromFile = (file) => promisify(fs.readFile)(file, 'utf-8')

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
		: obj;

const traverseThree = (root, func) => async (obj) => Promise
	.all(Object
		.entries(obj)
		.map(([key, val]) => func(val)
				.then(res => {
					if (isObject(val)) return traverseThree(root, func)(res)
							.then((data) => [key, data]);
					if (isArray(val)) return Promise
							.all(res.map(traverseThree(root, func)))
							.then((res) => [key, res]);
					return [key, res]
				})))
	.then(reduceEntriesToObject(obj));


const updateExternalField = (root) => async (obj) => isType('external-field')(obj)
	? getData(root)(obj.source)
		.then((val) => _.set(obj, obj.target, val))
	: obj;

const build = (root) => fp.flow(
	getJson(root),
	resolve(traverseThree(root, getSubtree(root))),
	resolve(traverseThree(root, updateExternalField(root))),
	resolve(async (data) => _.get(data, 'common')),
	resolve(console.log)
);

const root = build(githubRoot)(index);
	