// https://blog.logrocket.com/node-js-multithreading-what-are-worker-threads-and-why-do-they-matter-48ab102f8b10/

const { workerData, parentPort } = require('worker_threads')
const path = require('path')

const ImageDetails = require("./imageDetails");
const ImageStates = ImageDetails.States;
const Compress = require("./imageCompression");
const Persist = require("./imagePersistence");
const FS = require('fs');
const Events = require("./events")

// You can do any heavy stuff here, in a synchronous way
// without blocking the "main thread"



// trying websocket comms
// https://www.npmjs.com/package/websocket
// to make the GUI responsive
var WebSocketServer = require('websocket').server;
var http = require('http');
var httpServer;
var wsServer;
var connection;
var socketInputFile;
var socketOutputFolder;

function generalProgress(eventMessage){
    if(connection) {
        var message;
        if(eventMessage.constructor.name === "Event"){
            message = eventMessage;
        }else {
            if(eventMessage.constructor.name === "String"){
                message = Events.newLogEvent(eventMessage)
            }else {
                if (typeof eventMessage === "object") {
                    if (eventMessage.type && eventMessage.type === "log") {
                        message = eventMessage;
                    } else {
                        message = Events.newLogEvent(JSON.stringify(eventMessage)).setObject(eventMessage);
                    }
                }
            }
        }
        connection.sendUTF(JSON.stringify(message));
    }else {
        parentPort.postMessage({progress: eventMessage})
    }
}

function imageUpdate(image){
    parentPort.postMessage({ imageUpdate: JSON.parse(JSON.stringify( image))})
}

Compress.events.registerListener("general-update", generalProgress);

function startWebSocket(wsHttpPort){

    httpServer = http.createServer(function(request, response) {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });
    httpServer.listen(wsHttpPort, function() {
        console.log((new Date()) + ' Server is listening on port 8080');
    });

    wsServer = new WebSocketServer({
        httpServer: httpServer,
        // You should not use autoAcceptConnections for production
        // applications, as it defeats all standard cross-origin protection
        // facilities built into the protocol and the browser.  You should
        // *always* verify the connection's origin and decide whether or not
        // to accept it.
        autoAcceptConnections: false
    });

    wsServer.on('request', function(request) {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
            return;
        }

        connection = request.accept('echo-protocol', request.origin);
        console.log((new Date()) + ' Connection accepted.');
        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                console.log('Received Message: ' + message.utf8Data);
                connection.sendUTF(message.utf8Data);
                if(message.utf8Data=="app:start-compression"){
                    compressToFolder(socketInputFile, socketOutputFolder);
                }
            }
            else if (message.type === 'binary') {
                console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                connection.sendBytes(message.binaryData);
            }
        });
        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });
    });

    const originIsAllowed= (origin)=> {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    }

}


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

    FS.stat(inputFile, (err, stats)=>{
        if(!err){
            inputImage.setContentLength(stats.size);
        }
    });


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
        if(wsServer){
            wsServer.closeAllConnections();
            httpServer.close();
        }
    }

    if(message.action === "compressInSitu"){
        if(message.port){
            startWebSocket(message.port);
            socketInputFile = message.inputFile;
            socketOutputFolder = message.outputFolder;
        }else {
            compressInSitu(message.inputFile);
        }
    }

    if(message.action === "compressTo"){
        if(message.port){
            startWebSocket(message.port);
            socketInputFile = message.inputFile;
            socketOutputFolder = message.outputFolder;
        }else {
            compressToFolder(message.inputFile, message.outputFolder);
        }
    }
});