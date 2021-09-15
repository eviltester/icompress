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
            }
            if (typeof message === "object") {
                if(message.type && message.type==="log"){
                    message = event;
                }else {
                    message = Events.newLogEvent(JSON.stringify(event)).setObject(event);
                }
            }
        }
      //  messages.push(message);

      //  if(messages.length>5) {
            win.webContents.send('general-update', [message]);
//            messages = [];
     //   }

    // messageSender = setTimeout(()=>{
    //     win.webContents.send('general-update', messages)
    // }, 500);
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

        generalProgress("compressing in situ: " + inputFile);

        if (!inputFile || inputFile.trim().length==0) {
            throw "Require an input file to compress";
        }

        if(!FS.existsSync(inputFile)){
            throw "Could not find input file " + inputFile;
        }


            const workerData = { inputFile: inputFile };
            const worker = new Worker('./compress-worker.js', {workerData} );
            worker.on('message', (message)=>{
                if(message.progress){
                    generalProgress(message.progress);
                }
                if(message.imageUpdate){
                    imageUpdate(message.imageUpdate)
                }
                if(message.done){
                    generalProgress(message.done)
                }
                if(message.error){
                    generalProgress(message.error.error)
                }
            });
            worker.on('error', (error)=>{generalProgress(error)});
            worker.on('exit', (code) => {
                if (code !== 0)
                    generalProgress(`Worker stopped with exit code ${code}`);
            })

            // const parsed = path.parse(inputFile);
            // const fileName = parsed.base;
            // const dir = parsed.dir;
            //
            // const inputImage = new ImageDetails.Image();
            // inputImage.setSrc(Persist.combineIntoPath("local" + inputFile));
            // inputImage.setFullFilePath(inputFile);
            // inputImage.setOriginalFileName(fileName);
            // inputImage.setState(ImageStates.READY_TO_COMPRESS);
            //
            // const stats = FS.statSync(inputFile);
            // inputImage.setContentLength(stats.size);
            //
            // // imageQManager.addImageToCompressQueue(inputImage);
            // // but...since this is a single file, we can just await the compression code
            // generalProgress('about to compress single file ' + inputImage.getFullFilePath());
            // Compress.compress(inputImage, true, true).
            // then((image)=>{
            //     generalProgress('compressed ' + fileName);
            //     //process.exit(0);
            //     imageUpdate(image);
            //     resolve("Compressed " + inputFile);
            // }).catch((error)=>{reject(error)})

})

ipcMain.handle('app:compress-images-to', async (event, inputFile, outputFolder) => {


    return new Promise((resolve, reject)=>{

        generalProgress("compressing: " + inputFile);
        generalProgress("outputFolder: " + outputFolder);

        if (!inputFile || inputFile.trim().length==0) {
            throw "Require an input file to compress";
        }

        if(!FS.existsSync(inputFile)){
            throw "Could not find input file " + inputFile;
        }

        if (!outputFolder || outputFolder.trim().length==0) {
            throw "Require an output file to save to";
        }

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
        (async () => {
            generalProgress('about to compress single file ' + inputImage.getFullFilePath());
            anImage = await Compress.compressTo(inputImage, outputFolder, true, true);
            generalProgress('compressed ' + fileName);
            imageUpdate(anImage);
        })();

        resolve("Compressed " + inputFile);

    });

})