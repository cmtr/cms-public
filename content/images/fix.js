const fs = require('fs');
const { promisify } = require('util');
const getFromFile = (file) => promisify(fs.readFile)(file, 'utf-8');
const _ = require('lodash');

const fileRoot = '/home/harald/Workspace/cms-public/content/images/stock-images.json';

getFromFile(fileRoot)
	.then(JSON.parse)
	.then((arr) => arr.map(e => {
		const src = e.src.toLowerCase();
		return _.set(e, 'src', src);
	}))
	.then(JSON.stringify)
	.then((content) => {
		return fs.writeFileSync(fileRoot+"1", content)
	})
	.then(console.log);