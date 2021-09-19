const { app, BrowserWindow, dialog } = require('electron')
const { ipcMain } = require('electron')

const path = require('path')

const ImageDetails = require("../bin/imageDetails.js");
const ImageStates = ImageDetails.States;
const Compress = require("../bin/imageCompression");
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
let messages = [];
let messageSender;

function generalProgress(event){

    clearTimeout(messageSender);

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
      messages.push(message);

      if(messages.length>5) {
            win.webContents.send('general-update', messages);
            messages = [];
      }

    messageSender = setTimeout(()=>{
        if(messages.length>0) {
            win.webContents.send('general-update', messages)
            messages=[];
        }
    }, 500);
}

function imageUpdate(anImage){
    //console.log(anImage);
    // cannot send objects with functions so convert to a generic object first
    win.webContents.send('image-update', JSON.parse(JSON.stringify(anImage)));
}


Compress.events.registerListener("general-update", generalProgress);

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

ipcMain.handle('app:compress-images-insitu', async (event, inputFile) => {

    return new Promise((resolve, reject)=> {

        generalProgress("compressing in situ: " + inputFile);

        validationError = validateInputFile(inputFile);

        if(validationError){
            reject(validationError)
        }

        compressionWorker(inputFile).
        then(()=>{resolve("compressed " + inputFile)}).
        catch((error)=>{reject(error)});

    });

})

// returns error message if fail validation
function validateInputFile(inputFile){

    try {
        if (!inputFile || inputFile.trim().length == 0) {
            return ("Require an input file to compress");
        }

        if (!FS.existsSync(inputFile)) {
            return ("Could not find input file " + inputFile);
        }
    }catch(error){
        return error;
    }

    return undefined;
}

function compressionWorker(inputFile, outputFolder){

    return new Promise((resolve, reject)=>{
        const worker = new Worker('../bin/compress-worker.js');
        worker.on('message', (message) => {
            if (message.progress) {
                generalProgress(message.progress);
            }
            if (message.imageUpdate) {
                imageUpdate(message.imageUpdate)
            }
            if (message.done) {
                generalProgress(message.done)
                worker.postMessage({action: "exit"})
            }
            if (message.exit) {
                generalProgress("closed compression thread");
                resolve();
            }
            if (message.error) {
                generalProgress(message.error.error)
                worker.postMessage({action: "exit"})
            }
        });
        worker.on('error', (error) => {
            generalProgress(error)
            reject(error);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                generalProgress(`Worker stopped with exit code ${code}`);
                reject("unexpected exit");
            }
        })

        if(outputFolder===undefined || outputFolder===null) {
            worker.postMessage({action: "compressInSitu", inputFile: inputFile});
        }else{
            worker.postMessage({action: "compressTo",
                                inputFile: inputFile,
                                outputFolder: outputFolder});
        }
    })
}

ipcMain.handle('app:compress-images-to', async (event, inputFile, outputFolder) => {


    return new Promise((resolve, reject)=>{

        generalProgress("compressing: " + inputFile);
        generalProgress("outputFolder: " + outputFolder);

        validationError = validateInputFile(inputFile);

        if(validationError){
            reject(validationError)
        }

        if (!outputFolder || outputFolder.trim().length==0) {
            reject("Require an output file to save to");
        }

        compressionWorker(inputFile, outputFolder).
        then(()=>{resolve("compressed " + inputFile + " to " + outputFolder)}).
        catch((error)=>{reject(error)});

    });

})