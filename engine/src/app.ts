//2023-05-24T15:09:04.240Z [WEB API] info: We're going to replay ONE observation and its related information from the current pointer onwards: 134
//2023-05-24T15:09:04.241Z [WEB API] info: That observation is: undefined
//Waiting ....
//Event occured



// src/app.ts

// This is the Node Typescript logics module to serve the Vue.js front-end of the replay Challenge 82/83.
// It implements a WebAPI using Express.js.
// @author Stijn Verstichel (Stijn.Verstichel@UGent.be)
// UGent - imec - IDLab
// @date 20230525
// @version 2.0.2
//   This version currently supports:
//		- Loading datasets in N3 Store using the Streaming Mechanism,
//		- Getting a summary of measurents being loaded into the N3 Store,
//		- Checking the loading progress,
//		- Getting the amount of measurements loaded into the model,
//		- Sorting the measurements in increasing order of Timestamp,
//		- Replaying a single measurement to the Solid Pod, and advancing the pointer by one,
//		- Replaying the remaining items from the dataset, batch-wise to avoid HeapSpace issues
//		- Auto-replaying of the dataset, taking into account the timestamps between the observations in the dataset.
//		- Single user, single threaded approach.
//		- Real-time replaying, including status updates of the pointer position

//***********************************************************************************************************
// IMPORTS																									*
//***********************************************************************************************************

// Library to expose URL-based endpoints which can be called by the front-end(s). 
// [https://www.npmjs.com/package/express]
import express from 'express';
// CORS is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options.
// [https://www.npmjs.com/package/cors]
import cors = require('cors');
// LDESTS management
import { LDESTS, Shape } from "ldests"
// The logger as specifically used by versionawareldesinldp.
// [https://www.npmjs.com/package/@treecg/versionawareldesinldp]
import { Logger } from "@treecg/versionawareldesinldp/dist/logging/Logger";
// Load the config file with the values of all constants. This import style requires "esModuleInterop"
import * as propsJson from './config/replay_properties.json';
// Importing the OS module to get the hostname.
import * as os from 'os';
import { NamedNode, Quad, Store } from 'n3';

//***********************************************************************************************************
// REQUIRES																									*
//***********************************************************************************************************

const c = require('cors');
const fs = require('fs');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const { Subject } = require('await-notify');

//***********************************************************************************************************
// CONSTANTS																								*
//***********************************************************************************************************

const app = express();
//This is the back-end port to be used for the WebAPI.
const port = propsJson.port;
const loglevel = propsJson.loglevel;
const logger = new Logger(propsJson.logname, loglevel);
//Local Path to where the available datasets can be found.
const datasetFolders: Array<string> = [propsJson.datasetFolders];
//In case of Authentication this const contains the path to the credentials file. Ohterise: NULL.
const credentialsFileName = null;
// The shape used with the stream
const shape = buildShape();
// The resulting stream, retrieved and set async
let stream: LDESTS
buildStream().then((result) => stream = result);

const event = new Subject();

// builders

function buildShape() {
	const config = propsJson.shape;
	const builder = new Shape.Builder(config.type, config.identifier);
	for (const consts in config.constants) {
		builder.constant(consts, config.constants[consts]);
	}
	for (const vars in config.variables) {
		builder.variable(vars, config.variables[vars], 1);
	}
	return builder.build();
}

async function buildStream() {
	const config = propsJson
	const builder = new LDESTS.Builder(config.ldestsName)
        .config({ 'window': config.window, 'resourceSize': config.resourceSize })
        .shape(shape)
		.attachSolidPublisher(config.ldestsPod);
	for (const uris of config.queryURIs) {
		builder.queryUri("https://saref.etsi.org/core/measurementMadeBy")
	}
    return await builder.create();
}


//***********************************************************************************************************
// VARIABLES																								*
//***********************************************************************************************************

//This N3-store will be used as main knowledge container.
var store: Store = new N3.Store();
//Internal variable containing all subject URIs of the measurement in the dataset.
var observationSubjects: Array<string>;
//Internal variable containing the full Resoure as represetend above by URI(string), 
//but now also sorted according to the treePath.
var sortedObservationSubjects: Array<NamedNode> = [];
//Internal variable representing the index of replay (single user - single threaded).
var observationPointer: number = 0;
//Internal variable to keep track of the Authentication session object in case needed.
var session;
//This variabele defined whether or not the autoplay function is enabled
var autoplay = false;
//Time-out until the next observation to be replayed.
var newDifference;

//***********************************************************************************************************
// INIT																										*
//***********************************************************************************************************
app.use(cors());
app.listen(port, () => {
	return logger.info(`Express is listening at http://localhost:${port}`);
});
console.log(propsJson);

//***********************************************************************************************************
// WEB API METHODS																										*
//***********************************************************************************************************

// Returns an array of datafiles available to be used for replay!
app.get('/datasets/', (req, res) => {
	let jsonResult = [];
	logger.info("Local path where the datasets are located: " + datasetFolders[0]);
	fs.readdir(datasetFolders[0], (err, files) => {
		files.forEach(file => {
			jsonResult.push(file);
			logger.debug(file);
		});
		res.send(jsonResult);
	});
});

// Loads the selected dataset into the N3 Store.
app.get('/loadDataset', (req, res) => {
	logger.debug("" + req.query);
	let jsonResult = [];
	jsonResult.push('The Dataset that will be loaded, if not already done so: ' + req.query.dataset);
	logger.info('The Dataset that will be loaded: ' + req.query.dataset)

	const streamParser = new N3.StreamParser();
	if (os.platform() == 'win32') {
		const rdfStream = fs.createReadStream(datasetFolders[0] + "\\" + req.query.dataset);
		rdfStream.pipe(streamParser);

	} else if (os.platform() == 'linux') {
		const rdfStream = fs.createReadStream(datasetFolders[0] + "/" + req.query.dataset);
		rdfStream.pipe(streamParser);
	}
	else if (os.platform() == 'darwin') {
		const rdfStream = fs.createReadStream(datasetFolders[0] + "/" + req.query.dataset);
		rdfStream.pipe(streamParser);
	}
	else {
		logger.error('The OS is not supported by this application. Please use Linux, Windows or MacOS.');

	}

	// Stitching the streams together.
	streamParser.pipe(SlowConsumer());

	// (Re-)Initialising the N3 Store!
	store = new N3.Store();
	observationPointer = 0;

	// Internal function to control the Stream as fast as possible
	function SlowConsumer() {
		const writer = require('stream').Writable({ objectMode: true });
		writer._write = (quad, encoding, done) => {
			store.add(quad);
			done();
		};
		res.send(jsonResult);
		return writer;
	}
});

// Utility method for the front-end to check up on the loading progress.
app.get('/checkLoadingSize', (req, res) => {
	let jsonResult = [];
	jsonResult.push(store.countQuads(null, null, null, null));
	logger.info("The size of the loaded dataset: " + jsonResult + " quads");
	res.send(jsonResult);
});

// Analyses the loaded N3 Store and finds the amount of Measurements/Observations
// rather than the total Quad count. This can be done by using the Ontology, which
// specifies that an Observation is made by some kind of sensor, and those are 
// linked through the `https://saref.etsi.org/core/measurementMadeBy` property.
app.get('/checkObservationCount', (req, res) => {
	let jsonResult = [];
	let count = 0;
	for (const quad of store.match(null, namedNode('https://saref.etsi.org/core/measurementMadeBy'), null)) {
		count++;
	}
	jsonResult.push(count);
	logger.info("The amount of actual Obervation/Measurement instances in the dataset: " + count + " observations");
	res.send(jsonResult);
});

// Returns the information that is currently being referenced by the pointer, and thus is next
// to be replayed.
app.get('/checkPointer', (req, res) => {
	let jsonResult = [[]];
	for (const quad of store.match(sortedObservationSubjects[observationPointer], null, null)) {
		jsonResult[0].push(quad);
	}
	res.send(jsonResult);
});

// Returns the index of the current pointer, as well as the time-out until the next observation 
// is to be replayed when automatic replay is enabled.
app.get('/checkPointerPosition', (req, res) => {
	let jsonResult = [];
	//jsonResult.push(observationPointer);
	jsonResult.push({ "pointer": observationPointer });
	jsonResult.push({ "timeout": newDifference });
	console.log(jsonResult);
	res.send(jsonResult);
});

// The dataset, or at least the pointer to the items in the dataset, needs to be
// sorted as per timestamp. This is done by this method, and uses MERGE SORT.
// [https://www.geeksforgeeks.org/merge-sort/]
app.get('/sortObservations', async (req, res) => {

	logger.info("Start sorting the observations in the dataset.");
	// extract every resource based on the subject, where
	// the subject has the predicate https://saref.etsi.org/core/measurementMadeBy
	let temp = [];
	for (const quad of store.match(null, namedNode('https://saref.etsi.org/core/measurementMadeBy'), null)) {
		temp.push(quad.subject.value);
		logger.debug("PUSHING: " + quad.subject.value);
	}

	// as these values have a timestamp defined using the treePath, sorting can
	// be applied on this data; this is important for correct grouping later
	logger.debug("" + temp);
	logger.debug("NUMBER 0");
	logger.debug(temp[0]);

	// Start the sorting process with the list of subjects in the dataset.
	let sortedTemp = mergeSort(temp);

	// Up until now we sorted based on the String, representing the URI
	// of the Observations. This now also needs to be converted into namedNodes,
	// to facilitate quicker processing later on.
	sortedObservationSubjects = sortedTemp.map((subj) => namedNode(subj));

	let jsonResult = [];
	jsonResult.push(sortedTemp);
	logger.info("Finished sorting the observations in the dataset. Size: " + sortedObservationSubjects.length);
	res.send(jsonResult);
});

// Internal function that recursively calls itself, until the original set has
// reached its termination point, where the ever decreasing size of the (sub-)list
// to be sorted is <= 1.
function mergeSort(list: string[]): string[] {
	if (list.length <= 1) return list;
	let mid = Math.floor(list.length / 2);
	let left: string[] = mergeSort(list.slice(0, mid));
	let right: string[] = mergeSort(list.slice(mid));
	return merge(left, right);
}

// Once the recursively slicing of the list to be sorted has reached its
// termination point, the intermediate results need to be sorted and merged 
// together. This is the purpose of this internal function.
function merge(list1: string[], list2: string[]): string[] {
	let merged: string[] = [],
		i: number = 0,
		j: number = 0;
	while (i < list1.length && j < list2.length) {
		// Actual comparison is here using the correct property, not the URI of the observation itself.	
		let timestamp1 = store.getObjects(namedNode(list1[i]), namedNode('https://saref.etsi.org/core/hasTimestamp'), null)[0].value;
		logger.debug(timestamp1);
		let timestamp2 = store.getObjects(namedNode(list2[j]), namedNode('https://saref.etsi.org/core/hasTimestamp'), null)[0].value;
		logger.debug(timestamp2);

		//if (list1[i] < list2[j]) {
		if (timestamp1 < timestamp2) {
			merged.push(list1[i]);
			i++;
		} else {
			merged.push(list2[j]);
			j++;
		}
	}
	while (i < list1.length) {
		merged.push(list1[i]);
		i++;
	}
	while (j < list2.length) {
		merged.push(list2[j]);
		j++;
	}
	return merged;
}

// Returns a JSONArray with a list of the observations URIs in the N3-Store.
// Mind: only the URIs of the Observation Individuals are returned. Nothing else.
// Mind2: as this method is merely for visualisation purposes, the content is limited
// to the first 10 concatenated with the last 10 Observations in the N3Store.
app.get('/getObservations', (req, res) => {
	let finalResult = [];

	// FIXME: if the web-app doesn't function properly, this will have to be re-implemented at some point!
	// // A chunck with the first chunkSize (10).	
	// logger.info("Getting the FIRST " + chunkSize + " observations from the loaded store.");
	// const chunk = sortedObservationSubjects.slice(0, chunkSize);
	// logger.debug(chunk + "");
	// finalResult = finalResult.concat(chunk);
	// logger.debug(finalResult + "");

	// // A chunck with the last chunkSize (10).	
	// logger.info("Getting the LAST " + chunkSize + " observations from the loaded store.");
	// const chunk2 = sortedObservationSubjects.slice(sortedObservationSubjects.length - chunkSize, sortedObservationSubjects.length);
	// logger.debug(chunk2 + "");
	// finalResult.push("...");
	// finalResult = finalResult.concat(chunk2);

	res.send(finalResult);
});

// Replays the observation currently being addressed by the pointer, followed by
// increasing the position of the pointer by one.
async function advanceOneObservation() {
	// Move the pointer one step further in the datatset.
	const observationPointerTemp = observationPointer;
	observationPointer++;

	logger.info("We're going to replay ONE observation and its related information from the current pointer onwards: " + observationPointerTemp);
	logger.info("That observation is: " + sortedObservationSubjects[observationPointerTemp].value + "");

	if (typeof sortedObservationSubjects[observationPointerTemp] === 'undefined') {
		autoplay = false;
	} else {
		//Retrieving the set of all information/all triples currently related to the Observation being 	
		//identified by the Pointer the Observation itself.
		logger.info("Retrieving all related information to the Observation being replayed.");
		const finalResources: Quad[] = [];
		for (const quad of store.match(sortedObservationSubjects[observationPointerTemp], null, null)) {
			finalResources.push(quad as Quad);
		}
		logger.debug(finalResources + "");
		// inserting the resulting resources into the stream
		logger.info(`Inserting ${finalResources.length} resources`)
		await stream.insertStore(finalResources);
		// manually flushing so the results are visible
		await stream.flush();

		event.notify();
	}
}

// Main replay method in the WebAPI, based on the implementation from Wout Slabbinck/Tom Windels ==> STEP-WISE REPLAY	
app.get('/advanceAndPushObservationPointer', async (req, res) => {
	let jsonResult = [];

	await advanceOneObservation();

	// Inform the caller about the new pointer value.
	jsonResult.push(observationPointer);
	res.send(jsonResult);
});

// Main replay method in the WebAPI, based on the implementation from Wout Slabbinck/Tom Windels ==> STEP-WISE REPLAY	
app.get('/advanceAndPushObservationPointerToTheEnd', async (req, res) => {
	logger.info("We're going to replay the REMAINING observations and their related information from the current pointer onwards: " + observationPointer);
	let jsonResult = [];
	//Retrieving the set of all information/all triples currently related to the Observation being 
	//identified by the Pointer to the Observation itself.
	logger.info("Retrieving all related information to the Observation being replayed.");

	let batchnr = 0;
	logger.info("observation Pointer: " + observationPointer);
	logger.info("sorted Observation Subjects length:" + sortedObservationSubjects.length);

	// FIXME: reintroduce some of these consts
	// while (observationPointer < sortedObservationSubjects.length) {
	// 	logger.info("BATCH nr: " + batchnr);
	// 	batchnr++;

	// 	let finalResources = [];
	// 	let amount = 0;
	// 	for (let i = observationPointer; i < sortedObservationSubjects.length && i - observationPointer < batchSize; i++) {
	// 		amount++;
	// 		logger.info("resource: " + i);
	// 		let tempResources = [];
	// 		for (const quad of store.match(sortedObservationSubjects[i], null, null)) {
	// 			logger.debug(quad);
	// 			tempResources.push(quad);
	// 		}
	// 		finalResources.push(tempResources);
	// 	}
	// 	logger.debug(finalResources + "");

	// 	// grouping resources from sortedObservationSubjects together based on size of a single resource and the target resource
	// 	// size
	// 	// assume every sourceResource entry is of the same length (on average) to calculate the number of resources
	// 	// that are to be grouped together
	// 	logger.debug("targetResourceSize: " + targetResourceSize);

	// 	let amountResources: number = amount
	// 	// if input is not a number use the entire collection
	// 	if (isNaN(amount)) {
	// 		amountResources = sortedObservationSubjects.length
	// 	}
	// 	// Move the pointer to the end further in the datatset.
	// 	observationPointer = observationPointer + amountResources;
	// 	logger.info("New POINTER position:" + observationPointer);
	// 	// inserting the resulting resources into the stream
	// 	stream.insertBulk(finalResources);
	// 	// manually flushing so the results are visible
	// 	await stream.flush();
	// }

	res.send(jsonResult);
});

// Allows enabling the real-time auto play functionality
app.get('/startAutoPlay', async (req, res) => {
	autoplay = true;

	setTimeout(sayHi, 1);

	let jsonResult = ["Started"];
	res.send(jsonResult);
});

// Disables enabling the real-time auto play functionality
app.get('/stopAutoPlay', async (req, res) => {
	autoplay = false;
	let jsonResult = ["Stopped"];
	res.send(jsonResult);
});

// Implementation of the time-out logic to facilitate real-time replaying.
function sayHi() {
	logger.info('Hello');
	//Here we should call the push by one-method!
	advanceOneObservation();

	console.log('Waiting ....');
	event.wait();
	console.log('Event occured');

	var currentTimestamp;
	var nextTimestamp;

	for (const quad of store.match(sortedObservationSubjects[observationPointer], namedNode('https://saref.etsi.org/core/hasTimestamp'), null)) {
		logger.info(quad.object.value);
		currentTimestamp = quad.object.value;
	}

	for (const quad of store.match(sortedObservationSubjects[observationPointer + 1], namedNode('https://saref.etsi.org/core/hasTimestamp'), null)) {
		logger.info(quad.object.value);
		nextTimestamp = quad.object.value
	}

	const nextDate = new Date(nextTimestamp);
	const currentDate = new Date(currentTimestamp);
	const difference = nextDate.getTime() - currentDate.getTime();
	logger.info("DIFFERENCE (time-out):" + difference);
	// Setting a time-out with value 0, results in asynchronous behaviour ...	

	if (difference == 0) {
		newDifference = difference + 1;
	} else {
		newDifference = difference;
	}

	logger.info("NEW DIFFERENCE (time-out):" + newDifference);
	if (autoplay) {
		setTimeout(sayHi, newDifference);
	}
}