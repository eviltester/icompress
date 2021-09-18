// https://blog.logrocket.com/node-js-multithreading-what-are-worker-threads-and-why-do-they-matter-48ab102f8b10/

const { workerData, parentPort } = require('worker_threads')
const path = require('path')

const ImageDetails = require("../bin/imageDetails.js");
const ImageStates = ImageDetails.States;
const Compress = require("../bin/imageCompression");
const Persist = require("../bin/imagePersistence");
const FS = require('fs');

// You can do any heavy stuff here, in a synchronous way
// without blocking the "main thread"

function generalProgress(eventMessage){
    parentPort.postMessage({ progress: eventMessage })
}

function imageUpdate(image){
    parentPort.postMessage({ imageUpdate: JSON.parse(JSON.stringify( image))})
}

Compress.events.registerListener("general-update", generalProgress);




function compressInSitu(anInputFile) {
    const inputFile =anInputFile;

    const parsed = path.parse(inputFile);
    const fileName = parsed.base;
    const dir = parsed.dir;

    const inputImage = new ImageDetails.Image();
    inputImage.setSrc(Persist.combineIntoPath("local" + inputFile));
    inputImage.setFullFilePath(inputFile);
    inputImage.setOriginalFileName(fileName);
    inputImage.setState(ImageStates.READY_TO_COMPRESS);

    const stats = FS.statSync(inputFile);
    inputImage.setContentLength(stats.size);

    // imageQManager.addImageToCompressQueue(inputImage);
    // but...since this is a single file, we can just await the compression code

    generalProgress('about to compress single file ' + inputImage.getFullFilePath());
    Compress.compress(inputImage, true, true).
    then((image) => {
        generalProgress('compressed ' + fileName);
        //process.exit(0);
        imageUpdate(image);
        parentPort.postMessage({done: "Compressed " + inputFile})
        //resolve("Compressed " + inputFile);
    }).catch((error) => {
        parentPort.postMessage({error: error})
    })
}

function compressToFolder(inputFile, outputFolder){
    const parsed = path.parse(inputFile);
    const fileName = parsed.base;
    const dir = parsed.dir;

    const inputImage = new ImageDetails.Image();
    inputImage.setSrc(Persist.combineIntoPath("local" + inputFile));
    inputImage.setFullFilePath(inputFile);
    inputImage.setOriginalFileName(fileName);
    inputImage.setState(ImageStates.READY_TO_COMPRESS);

    const stats = FS.statSync(inputFile);
    inputImage.setContentLength(stats.size);

    // imageQManager.addImageToCompressQueue(inputImage);
    // but...since this is a single file, we can just await the compression code
    generalProgress('about to compress single file ' + inputImage.getFullFilePath());
    Compress.compressTo(inputImage, outputFolder, true, true).
    then((image) => {
        generalProgress('compressed ' + fileName);
        //process.exit(0);
        imageUpdate(image);
        parentPort.postMessage({done: "Compressed " + inputFile})
        //resolve("Compressed " + inputFile);
    }).catch((error) => {
        parentPort.postMessage({error: error})
    })

}



parentPort.on("message", message => {
    if (message.action === "exit") {
        parentPort.postMessage({ exit: "exiting" });
        parentPort.close();
    }

    if(message.action === "compressInSitu"){
        compressInSitu(message.inputFile);
    }

    if(message.action === "compressTo"){
        compressToFolder(message.inputFile, message.outputFolder);
    }
});