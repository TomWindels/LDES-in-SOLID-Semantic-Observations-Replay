import express from 'express';
import cors = require('cors');
import { LDESTS, Shape, Logger, PublisherType, SolidPublisherConfig } from "ldests"
import * as config from './config/replay_properties.json';
import * as os from 'os';
import { NamedNode, Quad, Store } from 'n3';
import fs from 'fs';
import N3 from 'n3';
import { Subject } from 'await-notify';

const { DataFactory } = N3;
const { namedNode } = DataFactory;

/** Engine globals **/

const app = express();
const port = config.port;
const datasetFolders: Array<string> = [config.datasetFolders];
const shape = Shape.Companion.parse(config.shape)
let stream: LDESTS

const event = new Subject();
var store: Store = new N3.Store();
var sortedObservationSubjects: Array<NamedNode> = [];
var observationPointer: number = 0;
var autoplay = false;
var newDifference;

/** Helpers **/

async function buildStream() {
	const builder = new LDESTS.Builder(config.ldestsName)
        .config({ 'window': config.window, 'resourceSize': config.resourceSize })
        .shape(shape)
		.attach({ type: PublisherType.Solid, url: config.ldestsPod } as SolidPublisherConfig);
	for (const uris of config.queryURIs) {
		builder.split(uris)
	}
    return await builder.build();
}

/** init code **/

buildStream().then((result) => stream = result);
app.use(cors());
app.listen(port, () => {
	return Logger.log("Engine", `Express is listening at http://localhost:${port}`);
});
console.log(config);

/** Routes **/

// Returns an array of datafiles available to be used for replay!
app.get('/datasets/', (req, res) => {
	Logger.log("Datasets", "Local path where the datasets are located: " + datasetFolders[0]);
	fs.readdir(datasetFolders[0], (err, files) => {
		res.send(files);
	});
});

// Loads the selected dataset into the N3 Store.
app.get('/loadDataset', (req, res) => {
	let jsonResult = ['The Dataset that will be loaded, if not already done so: ' + req.query.dataset];
	Logger.log("LoadDataset", 'The Dataset that will be loaded: ' + req.query.dataset)

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
		Logger.error("LoadDataset", 'The OS is not supported by this application. Please use Linux, Windows or MacOS.');
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
	Logger.log("CheckLoadingSize", "The size of the loaded dataset: " + jsonResult + " quads");
	res.send(jsonResult);
});

// Analyses the loaded N3 Store and finds the amount of samples
// rather than the total Quad count
app.get('/checkObservationCount', (req, res) => {
	const count = store.match(null, null, shape.sampleType).size;
	Logger.log("CheckObservationCount", "The amount of actual Obervation/Measurement instances in the dataset: " + count + " observations");
	res.send([count]);
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
	jsonResult.push({ "pointer": observationPointer });
	jsonResult.push({ "timeout": newDifference });
	Logger.log("CheckPointerPosition", `Pointer: ${observationPointer} - Timeout: ${newDifference}`);
	res.send(jsonResult);
});

// The dataset, or at least the pointer to the items in the dataset, needs to be
// sorted as per timestamp. This is done by this method, and uses MERGE SORT.
// [https://www.geeksforgeeks.org/merge-sort/]
app.get('/sortObservations', async (req, res) => {

	Logger.log("SortObservations", "Start sorting the observations in the dataset.");
	// extract every resource based on the subject, where the quad is of the requested type
	let temp = [];
	for (const quad of store.match(null, null, shape.sampleType)) {
		temp.push(quad.subject.value);
	}

	// Start the sorting process with the list of subjects in the dataset.
	let sortedTemp = mergeSort(temp);

	// Up until now we sorted based on the String, representing the URI
	// of the Observations. This now also needs to be converted into namedNodes,
	// to facilitate quicker processing later on.
	sortedObservationSubjects = sortedTemp.map((subj) => namedNode(subj));

	let jsonResult = [];
	jsonResult.push(sortedTemp);
	Logger.log("SortObservations", "Finished sorting the observations in the dataset. Size: " + sortedObservationSubjects.length);
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
		let timestamp1 = store.getObjects(namedNode(list1[i]), shape.sampleIdentifier, null)[0].value;
		let timestamp2 = store.getObjects(namedNode(list2[j]), shape.sampleIdentifier, null)[0].value;

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

// This method misses its actual implementation the web interface is expecting, but lacking this implementation
//  doesn't fundamentally break things
app.get('/getObservations', (req, res) => {
	Logger.warn("GetObservations", "This is currently not implemented, ignoring request...");
	res.send([]);
});

// Replays the observation currently being addressed by the pointer, followed by
// increasing the position of the pointer by one.
async function advanceOneObservation() {
	// Move the pointer one step further in the datatset.
	const observationPointerTemp = observationPointer;
	observationPointer++;

	Logger.log("AdvanceOneObservation", "Replaying a single observation and its related information from the current pointer onwards: " + observationPointerTemp);
	Logger.log("AdvanceOneObservation", "That observation is: " + sortedObservationSubjects[observationPointerTemp].value);

	if (typeof sortedObservationSubjects[observationPointerTemp] === 'undefined') {
		autoplay = false;
	} else {
		//Retrieving the set of all information/all triples currently related to the Observation being 	
		//identified by the Pointer the Observation itself.
		Logger.log("AdvanceOneObservation", "Retrieving all related information to the Observation being replayed.");
		const finalResources: Quad[] = [];
		for (const quad of store.match(sortedObservationSubjects[observationPointerTemp], null, null)) {
			finalResources.push(quad as Quad);
		}
		// inserting the resulting resources into the stream
		Logger.log("AdvanceOneObservation", `Inserting ${finalResources.length} resources`)
		await stream.insertAsStore(finalResources);
		// manually flushing so the results are visible
		await stream.flush();

		event.notify();
	}
}

app.get('/advanceAndPushObservationPointer', async (req, res) => {
	let jsonResult = [];

	await advanceOneObservation();

	// Inform the caller about the new pointer value.
	jsonResult.push(observationPointer);
	res.send(jsonResult);
});

// This method misses its actual implementation the web interface is expecting, but lacking this implementation
//  doesn't fundamentally break things
app.get('/advanceAndPushObservationPointerToTheEnd', async (req, res) => {
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", "We're going to replay the REMAINING observations and their related information from the current pointer onwards: " + observationPointer);
	let jsonResult = [];
	//Retrieving the set of all information/all triples currently related to the Observation being 
	//identified by the Pointer to the Observation itself.
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", "Retrieving all related information to the Observation being replayed.");
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", "Observation pointer: " + observationPointer);
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", "Remaining observation count:" + (sortedObservationSubjects.length - observationPointer));
	// getting all the remaining subjects and mapping these to all of their corresponding quads, so they are published in groups & in order
	const resources = sortedObservationSubjects
		.slice(observationPointer)
		.flatMap((subject) => store.getQuads(subject, null, null, null));
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", `Publishing ${resources.length} resources to the stream`);
	// Move the pointer to the end further in the datatset.
	observationPointer = observationPointer + resources.length;
	Logger.log("AdvanceAndPushObservationPointerToTheEnd", `New pointer position: ${observationPointer}`);
	// inserting the resulting resources into the stream
	stream.insertAsStore(resources);
	// manually flushing so the results are visible
	// not awaiting these calls to finish, just scheduling them to happen, so we can respond to the call in a respectable time
	stream.flush();
	// responding to the call
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
	Logger.log("SayHi", 'Hello');
	//Here we should call the push by one-method!
	advanceOneObservation();

	console.log('Waiting ....');
	event.wait();
	console.log('Event occured');

	var currentTimestamp;
	var nextTimestamp;

	for (const quad of store.match(sortedObservationSubjects[observationPointer], shape.sampleIdentifier, null)) {
		Logger.log("SayHi", quad.object.value);
		currentTimestamp = quad.object.value;
	}

	for (const quad of store.match(sortedObservationSubjects[observationPointer + 1], shape.sampleIdentifier, null)) {
		Logger.log("SayHi", quad.object.value);
		nextTimestamp = quad.object.value
	}

	const nextDate = new Date(nextTimestamp);
	const currentDate = new Date(currentTimestamp);
	const difference = nextDate.getTime() - currentDate.getTime();
	Logger.log("SayHi", "DIFFERENCE (time-out):" + difference);
	// Setting a time-out with value 0, results in asynchronous behaviour ...	

	if (difference == 0) {
		newDifference = difference + 1;
	} else {
		newDifference = difference;
	}

	Logger.log("SayHi", "NEW DIFFERENCE (time-out):" + newDifference);
	if (autoplay) {
		setTimeout(sayHi, newDifference);
	}
}