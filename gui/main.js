const { app, BrowserWindow, dialog } = require('electron')
const { ipcMain } = require('electron')

const path = require('path')
const QueueBasedScanner = require("../src/app/queueBasedScanner");
const Sitemapper = require('sitemapper');

let win = undefined;

const FS = require('fs');

const Events = require("../src/logging/Events");

function createWindow () {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false,
        }
    })

    win.loadFile('index.html')
}


const Ipc = require('node-ipc');


const ipc = new Ipc.IPCModule();
ipc.config.id = 'world';
ipc.config.retry=1500;

ipc.serve(
    function(){
        ipc.server.on(
            'app.message',
            function(data,socket){
                ipc.log('ipc got a message from', (data.id), (data.message));
                console.log('ipc console got a message from', (data.id), (data.message));
                generalProgress(data.message);
                // ipc.server.emit(
                //     socket,
                //     'app.message',
                //     {
                //         id      : ipc.config.id,
                //         message : data.message+' world!'
                //     }
                // );

                // if(messages.hello && messages.goodbye){
                //     ipc.log('got all required events, telling clients to kill connection');
                //     ipc.server.broadcast(
                //         'kill.connection',
                //         {
                //             id:ipc.config.id
                //         }
                //     );
                // }
            }
        );
    }
);

ipc.server.start();

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

function generalProgress(event){

    let message = event;
    if(event.constructor.name === "Event"){
        message = event;
    }else {
        if(event.constructor.name === "String"){
            message = Events.newLogEvent(event)
        }else {
            if (typeof message === "object") {
                if (message.type && message.type === "log") {
                    message = event;
                } else {
                    message = Events.newLogEvent(JSON.stringify(event)).setObject(event);
                }
            }
        }
    }
    win.webContents.send('general-update', message);
}

function imageUpdate(anImage){
    //console.log(anImage);
    // cannot send objects with functions so convert to a generic object first
    win.webContents.send('image-update', JSON.parse(JSON.stringify(anImage)));
}


//Compress.events.registerListener("general-update", generalProgress);

ipcMain.handle('app:compress-choose-input-file', async (event) => {
    dialog.showOpenDialog({
        properties: ['openFile'],
        message: "Choose File to Compress"
    }).then((response)=>{
        if (!response.canceled && response.filePaths.length > 0){
            win.webContents.send('chosen-input-file', response.filePaths[0]);
        }
    }).catch((err)=>{})

})

ipcMain.handle('app:compress-choose-output-folder', async (event) => {
    dialog.showOpenDialog({
        properties: ['openDirectory','createDirectory','promptToCreate'],
        message: "Choose Output Folder"
    }).then((response)=>{
        if (!response.canceled && response.filePaths.length > 0){
            win.webContents.send('chosen-output-folder', response.filePaths[0]);
        }
    }).catch((err)=>{})
})

// https://nodejs.org/docs/latest-v10.x/api/worker_threads.html
const { Worker } = require('worker_threads')



// returns error message if fail validation
function validateInputFile(inputFile){

    return new Promise((resolve, reject )=>{
        if (!inputFile || inputFile.trim().length == 0) {
            reject ("Require an input file to compress");
        }

        FS.stat(inputFile,(error, stats)=> {
            if(error){
                reject(error);
            }
            if(!stats.isFile()){
                reject("Could not find input file " + inputFile);
            }else{
                resolve(inputFile)
            }
        })
    });
}

function compressionWorker(inputFile, outputFolder){

        const worker = new Worker('../src/workers/compress-worker.js');
        worker.on('message', (message) => {
            console.log("on message " + JSON.stringify(message));
            if (message.progress) {
                generalProgress(message.progress);
            }
            if (message.imageUpdate) {
                imageUpdate(message.imageUpdate)
            }
            if (message.done) {
                worker.postMessage({action: "exit"});
            }
            if (message.exit) {
                generalProgress("closed compression thread");
            }
            if (message.error) {
                generalProgress(message.error.error)
                worker.postMessage({action: "exit"})
            }
        });
        worker.on('error', (error) => {
            generalProgress(error)
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                generalProgress(`Worker stopped with exit code ${code}`);
            }
        })

        if(outputFolder===undefined || outputFolder===null) {
            worker.postMessage({action: "compressInSitu", inputFile: inputFile, port:8080});
        }else{
            worker.postMessage({action: "compressTo",
                                inputFile: inputFile,
                                outputFolder: outputFolder, port:8080});
        }
}

ipcMain.on('app:compress-images-insitu',  (event, inputFile) => {

    generalProgress("compressing in situ: " + inputFile);

    validateInputFile(inputFile).then(
        compressionWorker(inputFile)
    ).catch(error=>{console.log(error)})


})

ipcMain.on('app:compress-images-to', (event, inputFile, outputFolder) => {

    generalProgress("compressing: " + inputFile);
    generalProgress("outputFolder: " + outputFolder);

    if (!outputFolder || outputFolder.trim().length==0) {
        generalProgress("Require an output file to save to");
        return;
    }

    validateInputFile(inputFile).
        then(()=>{
            compressionWorker(inputFile, outputFolder)
        }).catch(errorMessage =>{
           console.log(errorMessage);
        });
})






/*

    Queue Processing Functionality

 */


let nothingToDoCount=0;
let quitWhenNothingToDoInterval = undefined;
let scanner = undefined;

const quitIfQueuesAreEmpty = ()=>{
    let shouldIQuit = false;

    if(
        scanner.queuesAreEmpty()
    ){
        shouldIQuit= true;
        nothingToDoCount++;
    }else{
        nothingToDoCount=0;
    }

    console.log("nothing to do " + nothingToDoCount);

    // add a delay before quiting
    // todo: add a config param for TimesToCheckQueueBeforeExiting
    if(nothingToDoCount<5){
        console.log("Page Queues");
        console.log("-----------");
        console.log(scanner.getPageQManager().queues().reportOnQueueLengths());
        console.log("Image Queues");
        console.log("------------");
        console.log(scanner.getImageQManager().queues().reportOnQueueLengths());
        return;
    }

    if(shouldIQuit){
        console.log(scanner.getPageQManager().queues().reportOnQueueLengths());
        console.log(scanner.getPageQManager().queues().reportOnAllQueueContents())

        console.log(scanner.getImageQManager().queues().reportOnQueueLengths());
        console.log(scanner.getImageQManager().queues().reportOnAllQueueContents());
        scanner.getImageQManager().outputImageJsonFiles();
        scanner.stopQueueProcessing();
        clearInterval(quitWhenNothingToDoInterval);
    }
}




ipcMain.on('app:process-sitemap-to', (event, sitemapXml, outputFolder) => {

    generalProgress("processing: " + sitemapXml);
    generalProgress("outputFolder: " + outputFolder);

    if (!outputFolder || outputFolder.trim().length==0) {
        generalProgress("Require an output file to save to");
        return;
    }

    const forceactions = {download: false, compressffmpeg: false, compressmagick:false};

    // todo: put this in a worker thread, then add the thread to index.js
    // todo: fix path handling as it loads in relative folder for outputFolder
    scanner = new QueueBasedScanner.Scanner(outputFolder, forceactions);

    // todo: for some reason this does not work in electron
    const sitemap = new Sitemapper({url: sitemapXml, debug:true});

    sitemap.fetch().
    then(function(sites) {
        console.log(sitemap);
        console.log(sites);
        sites.sites.forEach((siteUrl)=> {
                scanner.addPageToScan(siteUrl);
            }
        );
        quitWhenNothingToDoInterval = setInterval(()=>{quitIfQueuesAreEmpty()},1000);
        scanner.startQueueProcessing();
    }).catch((error)=> {
        generalProgress("Error Reading Sitemap from " + options.xmlsitemap);
        generalProgress(error);
    });

    console.log("sitemap");

})