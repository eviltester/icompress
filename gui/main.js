const { app, BrowserWindow, dialog } = require('electron')
const { ipcMain } = require('electron')

const path = require('path')

const ImageDetails = require("../bin/imageDetails.js");
const ImageStates = ImageDetails.States;
const Compress = require("../bin/imageCompression");
const Persist = require("../bin/imagePersistence");
let win = undefined;


const Events = require("../bin/Events.js");
const events = new Events.Register();
events.registerListener("console.log", (eventDetails)=>{console.log(eventDetails)});

function createWindow () {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false
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



function generalProgress(event){
    let message = event;
    if(event.constructor.name === "Event"){
        message = event.message;
    }else {
        if (typeof message === "object") {
            message = JSON.stringify(event);
        }
    }
    win.webContents.send('general-update', message);
}
function imageUpdate(anImage){
    console.log(anImage);
    // cannot send objects with functions so convert to a generic object first
    win.webContents.send('image-update', JSON.parse(JSON.stringify(anImage)));
}


Compress.events.registerListener("general-update", generalProgress);

ipcMain.handle('app:compress-images-insitu', async (event) => {


    // quick hack
    generalProgress("received message")

    dialog.showOpenDialog({
        properties: ['openFile']
    }).then((response) => {
        generalProgress(response)
        if (!response.canceled && response.filePaths.length > 0) {
            generalProgress("compresssing")
            for(inputFile of response.filePaths) {
                const parsed = path.parse(inputFile);
                const fileName = parsed.name;
                const dir = parsed.dir;

                const inputImage = new ImageDetails.Image();
                inputImage.setSrc(Persist.combineIntoPath("local" + inputFile));
                inputImage.setFullFilePath(inputFile);
                inputImage.setOriginalFileName(fileName);
                inputImage.setState(ImageStates.READY_TO_COMPRESS);

                // imageQManager.addImageToCompressQueue(inputImage);
                // but...since this is a single file, we can just await the compression code
                (async () => {
                    generalProgress('about to compress single file ' + inputImage.getFullFilePath());
                    anImage = await Compress.compress(inputImage, true, true);
                    generalProgress('compressed ' + fileName);
                    //process.exit(0);
                    imageUpdate(anImage);
                })();
            }
        }
    }).catch((error) => {return error;})

})