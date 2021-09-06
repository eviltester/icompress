const { app, BrowserWindow, dialog } = require('electron')
const { ipcMain } = require('electron')

const path = require('path')

const ImageDetails = require("../bin/imageDetails.js");
const ImageStates = ImageDetails.States;
const Compress = require("../bin/imageCompression");
const Persist = require("../bin/imagePersistence");

function createWindow () {
    const win = new BrowserWindow({
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

ipcMain.handle('app:compress-images-insitu', async (event) => {

    // quick hack
    console.log("received message")

    dialog.showOpenDialog({
        properties: ['openFile']
    }).then((response) => {
        console.log(response)
        if (!response.canceled && response.filePaths.length > 0) {
            console.log("compresssing")
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
                    console.log('about to compress single file');
                    await Compress.compress(inputImage, true, true);
                    console.log('compressed ' + fileName);
                    process.exit(0);
                })();
            }
        }
    }).catch((error) => {return error;})

})