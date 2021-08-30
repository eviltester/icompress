#!/usr/bin/env node

// http://yargs.js.org/
const yargs = require("yargs");

// https://nodejs.org/api/fs.html
const FS = require('fs');

//https://nodejs.org/api/path.html
const Path = require('path');

// https://www.npmjs.com/package/animated-gif-detector
const AnimatedGifDetector = require('animated-gif-detector');

// https://github.com/matthew-andrews/isomorphic-fetch
const fetch = require('isomorphic-fetch');

//https://github.com/jsdom/jsdom
const { JSDOM } = require("jsdom");

const HTTP = require("./httpWrapper.js");

//https://nodejs.org/api/timers.html
const { setInterval } = require("timers");

// https://nodejs.org/api/url.html
const Url = require('url').URL;

const ImageQueues = require("./imageQueues.js");
const Shell = require("./commandLineExec.js");
const ImageDetails = require("./imageDetails.js");
const ImageStates = ImageDetails.States;
const FFMPEG = require("./ffmpegWrapper.js");
const ImageMagick = require("./imageMagickWrapper.js");
const imageQueues = new ImageQueues();

const ImageHTTP = require("./imageHttp.js");

/*

    WIP:
        - refactoring out into classes

    BUGS:

    TODOs:
    - NEXT
        - split code into modules and classes
        - add output file paths and output file sizes to the img so that this is in the json output
    - typescript?
    - add tests for the modules and classes
    - configuration and defaults for hard coded values
    - spidering
        - evaluate existing node.js spiders to see if there is something configurable that supports plugins then our image processing could be a plugin
        - scan a url and crawl for all pages, then evaluate for images - create objects for page, urls to scan etc.
        - image processing should be a 'task' to apply on pages to support future expansion of spider
    - scan folder of images rather than urls and create a mirror folder with compressed images for local work
    - GUI/App to make it easier e.g. add url, scan, save progress, interrupt and restart, rescan etc.
 */





/*
    Directory/File Management

 */

function createDir(dir){
    console.log("creating: "  + dir);
    try {
        if (!FS.existsSync(dir)) {
            FS.mkdirSync(dir, { recursive: true }); // create all subdirectories
        }
    } catch (err) {
        console.error(err);
    }
}


/*
    Startup
 */

// todo: check if ffmpeg and imagemagick are installed, if not then exit with error messages
// todo: have a 'retry' for any of the images in an output state file which were in an 'error' state and pick up from the last valid state
// todo: add an output folder option rather than always using the current folder
const options = yargs
 .usage("Usage: -i <inputfilename> -page <urlForAPageToProcess>")
 .option("i", { alias: "inputname", describe: "Input file name", type: "string", demandOption: false })
 .option("p", { alias: "pageurl", describe: "Url for a page to process", type: "string", demandOption: false })
 .argv;

 if(options.inputname){
    const parsed = Path.parse(options.inputname);
    const fileName = parsed.name;
    const dir = "./" + parsed.dir;
    const inputImage = new ImageDetails.Image();
    inputImage.setSrc("local/"+options.inputname);
    inputImage.setFullFilePath(options.inputname);
    inputImage.setState(ImageStates.READY_TO_COMPRESS);
    imagesToCompress.push(inputImage);
 }



// if we are given a url then create a root folder using the domain name
let rootFolder = "";
if(options.pageurl){
    const givenPageUrl = new Url(options.pageurl);
    rootFolder = givenPageUrl.hostname;
    createDir(rootFolder);
}

/*
    Started
 */

// given a page
// get the source and find all images
// get all images and download those which are > 50K based on header to a folder

// todo: create a page scanning queue and add the url there, then a queue processor, then we can easily add a set of urls, and fairly quickly build a set of urls to scan
if(options.pageurl){

    console.log(options.pageurl)
    // todo build a queue of urls by scanning a site
    HTTP.getDomFromUrl(options.pageurl).
    then((dom)=>{
        const imgs=dom.window.document.querySelectorAll("img");
        for(const imageNode of imgs){
            let imageUrl = imageNode.getAttribute("src");
            let divider = "";
            if(!imageUrl.startsWith("/")){
                divider = "/";
            }
            if(!imageUrl.includes(":/")){
                // image is relative
                imageUrl = options.pageurl + divider + imageUrl;
            }
            ImageHTTP.getImageHeaders(imageUrl)
            .then((img)=>{
                img.setFoundOnPageUrl(options.pageurl);
                imageQueues.addToProcessQueue(img);

            }).catch((error)=>{console.log("image error"); console.log(error)});    
        }

    }).catch((error)=>{
        console.log("processing error");
        console.log(error);
    });
}



function filterImagesAndAddToDownloadQueue(maxK){

    const image = imageQueues.findFirstImageWithState(ImageStates.FETCHED_HEADERS, imageQueues.QNames.IMAGES_TO_PROCESS);
    if(image==null){
        return;
    }

    image.setState(ImageStates.SHOULD_DOWNLOAD_EVALUATION);

    if(image.getContentLength()>=(maxK*1000)){
        image.setState(ImageStates.WILL_DOWNLOAD);
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_PROCESS, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    }else{
        image.setState(ImageStates.IGNORED);
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_PROCESS, imageQueues.QNames.IMAGES_TO_IGNORE);
    }
}

// todo: add to ImagePersistance module
function outputImageJsonFile(image) {
    //https://nodejs.dev/learn/writing-files-with-nodejs
    try {
        const data = FS.writeFileSync(image.getFullFilePath() + ".json", JSON.stringify(image, null, 2));
        //file written successfully
    } catch (err) {
        console.error(err)
    }
}

function outputImageJsonFiles(imagesToOutput) {

    for(const image of imagesToOutput){
        outputImageJsonFile(image);
    }
}

// todo: add to ExitBasedOnQueues module
let nothingToDoCount=0;

const quitIfQueuesAreEmpty = ()=>{
    let shouldIQuit = false;

    if(imageQueues.allProcessIngQueuesAreEmpty()){
        shouldIQuit= true;
        nothingToDoCount++;
    }else{
        nothingToDoCount=0;
    }

    console.log("nothing to do " + nothingToDoCount);

    // add a delay before quiting
    // todo: add a config param for TimesToCheckQueueBeforeExiting
    if(nothingToDoCount<5){
        console.log(imageQueues.reportOnQueueLengths());
        return;
    }

    if(shouldIQuit){
        console.log(imageQueues.reportOnQueueLengths());
        console.log(imageQueues.reportOnAllQueueContents())
        outputImageJsonFiles(imageQueues.getImagesFromQueue(imageQueues.QNames.COMPRESSED_IMAGES));
        process.exit(0); // OK I Quit
    }
}

// todo: add to ImagePersistance module
function createFolderStructureForImage(image, root) {
    return new Promise((resolve, reject) => {
        try {
            image.setState(ImageStates.CREATING_FOLDERS);
            image.setRootFolder(root);

            //const urlToParse = img.src;
            const urlToParse = image.getFoundOnPage();

            // create a page folder
            const pathParts = new Url(urlToParse).pathname.split('/').filter(item => item !="");
            const dir = pathParts.join('_');
            image.setUrlPath(dir);

            // create an image name folder
            const fileNamePathParts = new Url(image.getSrc()).pathname.split('/');
            const fileName = fileNamePathParts[fileNamePathParts.length - 1];
            image.setOriginalFileName(fileName);

            console.log("creating dir " + dir);
            // todo: possibly have a state/queue for create imageDir or store output dir in the image as a field?
            const fileDirPath = image.getRootFolder() + Path.sep + image.getUrlPath() + Path.sep + image.getOriginalFileName();
            image.setFileDirPath(fileDirPath);
            createDir(fileDirPath);

            image.setState(ImageStates.FILE_SYSTEM_IS_READY);
            resolve(image);
        }catch(error){
            image.setState(ImageStates.ERROR_CREATING_FOLDERS);
            image.addErrorReport(error);
            reject(image);
        }
    });
}

// todo: add to an ImageQueuesProcessing module
const processQueueToCreateFolderStructure = ()=>{
    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.WILL_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }

    createFolderStructureForImage(imageToDownload, rootFolder).
    then((image)=>{
        image.setState(ImageStates.AWAITING_DOWNLOAD);
        // no Qs to move
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_DOWNLOAD, imageQueues.QNames.ERROR_PROCESSING_IMAGES)
    });

}

// todo: add to an ImageQueuesProcessing module
const processDownloadImagesQ = ()=>{

    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.AWAITING_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }
    imageToDownload.setState(ImageStates.ABOUT_TO_DOWNLOAD);

    imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.IMAGES_TO_DOWNLOAD, imageQueues.QNames.DOWNLOADING_IMAGES);

    console.log(imageQueues.reportOnQueueContents(imageQueues.QNames.IMAGES_TO_DOWNLOAD));
    ImageHTTP.downloadImageFile(imageToDownload).
    then(()=>{
        imageToDownload.setState(ImageStates.READY_TO_COMPRESS);
        imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.DOWNLOADING_IMAGES, imageQueues.QNames.IMAGES_TO_COMPRESS);
    }).
    catch((error)=> {
        imageToDownload.setState(ImageStates.ERROR_DOWNLOADING);
        imageToDownload.addErrorReport(error);
        imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.DOWNLOADING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES);
    });

}

// todo: move to an ImageCompressWrapper class
function ffmpegCompress(imageToFFmpeg, inputFileName, outputFileName) {

    imageToFFmpeg.setState(ImageStates.COMPRESSING_VIA_FFMPEG);

    return new Promise((resolve, reject)=>{
        const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};
        FFMPEG.compress(inputFileName, outputFileName)
        //Shell.execParas(ffmpeg, commandDetails)
            .then((result)=>{
                imageToFFmpeg.setState(ImageStates.COMPRESSED_VIA_FFMPEG);
                imageToFFmpeg.addCommand(result.ffmpeg, result.commandDetails);
                resolve(imageToFFmpeg)
            }).catch((error)=> {
            imageToFFmpeg.setState(ImageStates.ERROR_FFMPEG_COMPRESS);
            imageToFFmpeg.addErrorReport(error);
                reject(imageToFFmpeg);
        })
    });
}

// todo: move to an ImageCompressWrapper class
// todo: in the future allow custom commands to be added for images
// todo: document this command fully
// todo: allow config for the different compression options e.g. colours, colour depth, dither, etc.
function imageMagickCompress(imageToCompress, inputFileName, outputFileName) {

    imageToCompress.setState(ImageStates.COMPRESSING_VIA_IMAGEMAGICK);

    return new Promise((resolve, reject)=>{
        ImageMagick.compress(inputFileName, outputFileName)
            .then((result)=>{
                imageToCompress.setState(ImageStates.COMPRESSED_VIA_IMAGEMAGICK);
                imageToCompress.addCommand(result.imagemagick, result.commandDetails);
                resolve(imageToCompress);
            }).catch((error)=> {
            imageToCompress.setState(ImageStates.ERROR_IMAGEMAGICK_COMPRESS);
            imageToCompress.addErrorReport(error);
                reject(imageToCompress);
        })
    });
}

// todo: add to an ImageQueuesProcessing module
const processCompressImagesQ = ()=>{

    const imageToCompress = imageQueues.findFirstImageWithState(ImageStates.READY_TO_COMPRESS, imageQueues.QNames.IMAGES_TO_COMPRESS);
    if(imageToCompress==null){
        return;
    }
    imageToCompress.setState(ImageStates.ABOUT_TO_COMPRESS);
    imageQueues.moveFromQToQ(imageToCompress, imageQueues.QNames.IMAGES_TO_COMPRESS, imageQueues.QNames.COMPRESSING_IMAGES);

    const writtenImagePath = Path.parse(imageToCompress.getFullFilePath());
    const pathPrefix = "./";

    // possibly use Path.relative() with "./" or preocess.cwd()
    const inputFileName = pathPrefix + imageToCompress.getFullFilePath();
    const outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
    const compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.getOriginalFileName();

    // todo: the if else should be in the ImageCompressWrapper class
    if(AnimatedGifDetector(FS.readFileSync(imageToCompress.getFullFilePath()))){

        ffmpegCompress(imageToCompress, inputFileName, outputFileName)
            .then((image)=> {
                imageMagickCompress(imageToCompress, outputFileName, compressedFileName)
                .then((image)=> {
                    imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.COMPRESSED_IMAGES);
                        outputImageJsonFile(image);
                })
                .catch((image)=>{imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES)});
            })
            .catch((image)=>{imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES)});

    }else{
        // just apply image magic
        imageMagickCompress(imageToCompress, inputFileName, compressedFileName).
        then((image)=>{
            imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.COMPRESSED_IMAGES);
                outputImageJsonFile(image);
        }).
        catch((image)=>{imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES)});
    }
};


const quitWhenNothingToDoInterval = setInterval(()=>{quitIfQueuesAreEmpty()},1000);
const createFolderStructureQInterval = setInterval(()=>{processQueueToCreateFolderStructure()},100)

// todo: add to an ImageQueuesProcessing module
const downloadImagesQInterval = setInterval(()=>{processDownloadImagesQ()},500)
const compressImagesQInterval = setInterval(()=>{processCompressImagesQ()},1000);
const reportOnImageQsInterval = setInterval(()=>{console.log(imageQueues.reportOnQueueLengths())},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(50)},500);



