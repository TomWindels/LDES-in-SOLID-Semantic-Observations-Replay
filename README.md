# LDESTS demo
This repository contains a copy of an initial LDESTS implementation, found in `lib`. A separate README is available there. The demo, found in `demo`, reuses a tool which allows the replay of captured RDF data. It allows the user to select a dataset to load & sort, followed by submitting its data in segments or in its entirety to the configured Solid pod. It also comes with a separate README.
## Demonstration
A demo using a subset of the [DAHCC](https://dahcc.idlab.ugent.be/dataset.html) dataset is used for demonstration purposes. This subset only contains the accelerometer data captured by smartphones. The shape had been adjusted for this specific subset, and the entire capture was published.


https://github.com/TomWindels/LDESTS-demo/assets/57372186/d8cf225e-a8fd-4e26-9fcf-493c97c45bb7

[Click here to open the video in a new tab](https://github-production-user-asset-6210df.s3.amazonaws.com/57372186/253955553-d8cf225e-a8fd-4e26-9fcf-493c97c45bb7.mp4)

## Trying the demo yourself
**Notice**: The demo has only been tested on Linux machines, but other platforms should function just fine after making minor adjustments to the commands listed below. Make sure the commands `git`, `npm` and `yarn` are available first.
### Preparation
First, the LDESTS implementation has to be built from source, as the demo depends on this local build. This can be done by navigating to the `lib` folder and starting the relevant gradle build:
```
[user@host LDESTS-demo]$ cd lib
[user@host lib]$ ./gradlew jsLibrary:jsBuild
```
After this has completed, the library (found in `lib/bin/js`) can be used by the demo. More details about the build process can be found in `lib/README.md`.
Both `engine` and `webapp` have their own sets of dependencies, which can be installed by executing `npm i` in their respective folders:
```
[user@host LDESTS-demo]$ cd demo/engine
[user@host engine]$ npm i
[user@host engine]$ cd ../webapp
[user@host webapp]$ npm i
```
The demo can be configured in `demo/engine/src/config/replay_properties.json`. A more in-depth explanation about this configuration can be found in `demo/README.md`. The most important properties to configure are the `datasetFolders` location (configured by default to be at `demo/engine/data`) and the data's `shape`.\
Before running the demo, it is important to have a Solid server running that you can modify freely. Make sure the URL matches the one set in `demo/engine/src/config/replay_properties.json`. We used a locally running [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) instance with the default configuration for this demo.
### Running
You need two terminal instances to run the demo: one for the frontend, and one for the underlying engine managing the data and using LDESTS. Navigate the first terminal window to `demo/engine` and start the engine:
```
[user@host LDESTS-demo]$ cd demo/engine
[user@host engine]$ npm start
```
Next, navigate the second terminal to `demo/webapp` and start the frontend:
```
[user@host LDESTS-demo]$ cd demo/webapp
[user@host webapp]$ npm run dev
```
This terminal should now contain the URL you can navigate to when you want to access the frontend and start testing the demo.
