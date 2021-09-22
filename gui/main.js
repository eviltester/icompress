const { app, BrowserWindow, dialog } = require('electron')
const { ipcMain } = require('electron')

const path = require('path')

const ImageDetails = require("../bin/imageDetails.js");
const ImageStates = ImageDetails.States;
//const Compress = require("../bin/imageCompression");
const Persist = require("../bin/imagePersistence");
let win = undefined;

const FS = require('fs');

const Events = require("../bin/Events.js");
const events = new Events.Register();
//events.registerListener("console.log", (eventDetails)=>{console.log(eventDetails)});

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

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})



// message queue to try to make GUI more responsive
// let messages = [];
// let messageSender;

function generalProgress(event){

    //clearTimeout(messageSender);

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
      // messages.push(message);
      //
      // if(messages.length>5) {
            win.webContents.send('general-update', message);
    //         messages = [];
    //   }
    //
    // messageSender = setTimeout(()=>{
    //     if(messages.length>0) {
    //         win.webContents.send('general-update', messages)
    //         messages=[];
    //     }
    // }, 500);
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

        const worker = new Worker('../bin/compress-worker.js');
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
                //generalProgress("closed compression thread");
                win.webContents.send('close-compression-web-socket', "");
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

        // tell GUI to connect to websocket on port
        win.webContents.send('general-update-port', 8080);

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