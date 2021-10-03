// https://blog.logrocket.com/node-js-multithreading-what-are-worker-threads-and-why-do-they-matter-48ab102f8b10/

const { workerData, parentPort } = require('worker_threads')
const path = require('path')

const ImageDetails = require("../domain/imageDetails");
const ImageStates = ImageDetails.States;
const Compress = require("../compression/imageCompression");
const Persist = require("../persistence/imagePersistence");
const FS = require('fs');
const Events = require("../../bin/events")


function generalProgress(eventMessage){
    parentPort.postMessage({progress: eventMessage})
}

function imageUpdate(image){
    parentPort.postMessage({ imageUpdate: JSON.parse(JSON.stringify( image))})
}

Compress.events.registerListener("general-update", generalProgress);

function compressInSitu(anInputFile) {
    return compressToFolder(anInputFile, undefined);
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

    // check file exists
    FS.stat(inputFile, (err, stats)=>{
        if(!err){
            inputImage.setContentLength(stats.size);

            // imageQManager.addImageToCompressQueue(inputImage);
            generalProgress('about to compress single file ' + inputImage.getFullFilePath());
            Compress.compressTo(inputImage, outputFolder, true, true).
            then((image) => {
                generalProgress('compressed ' + fileName);
                //process.exit(0);
                imageUpdate(image);
                parentPort.postMessage({done: "Compressed " + inputFile})
            }).catch((error) => {
                parentPort.postMessage({error: error})
            })
        }else{
            parentPort.postMessage({error: err})
        }
    });

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