#!/usr/bin/env node

// http://yargs.js.org/
const yargs = require("yargs");

// https://nodejs.org/api/fs.html
const FS = require('fs');

//https://nodejs.org/api/path.html
const Path = require('path');

const HTTP = require("./httpWrapper.js");

//https://nodejs.org/api/timers.html
const { setInterval } = require("timers");

// https://nodejs.org/api/url.html
const Url = require('url').URL;

const ImageQueues = require("./imageQueues.js");
const ImageDetails = require("./imageDetails.js");
const ImageStates = ImageDetails.States;
const imageQueues = new ImageQueues();
const CompressImage = require("./imageCompression");
const Persist = require("./imagePersistence");

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
    Startup
 */

// todo: check if ffmpeg and imagemagick are installed, if not then exit with error messages
// todo: have a 'retry' for any of the images in an output state file which were in an 'error' state and pick up from the last valid state
// todo: add an output folder option rather than always using the current folder
// todo: given a sitemap, scan all the pages listed in the sitemap - file or url
// todo: given a file with a list of page urls, process those
// todo: have a -scan method which only does the 'head' and reports on what should be downloaded and what should be ignored but does not actually download or compress
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
    Persist.createDir(rootFolder);
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
                imageQueues.addToQueue(img, imageQueues.QNames.IMAGES_TO_PROCESS);

            }).catch((error)=>{console.log("image error"); console.log(error)});    
        }

    }).catch((error)=>{
        console.log("processing error");
        console.log(error);
    });
}

function findFirstImageWithState(state, qName){
    return imageQueues.findFirstInQWhere(qName, (image) => {return image.getState()==state})
}

function filterImagesAndAddToDownloadQueue(maxK){

    //const image = imageQueues.findFirstInQWhere(imageQueues.QNames.IMAGES_TO_PROCESS, (image) => {return image.getState()==ImageStates.FETCHED_HEADERS})

    const image = findFirstImageWithState(ImageStates.FETCHED_HEADERS, imageQueues.QNames.IMAGES_TO_PROCESS);
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




// todo: add to ExitBasedOnQueues module
let nothingToDoCount=0;

const quitIfQueuesAreEmpty = ()=>{
    let shouldIQuit = false;

    if(imageQueues.allGivenQueuesAreEmpty([
                            imageQueues.QNames.IMAGES_TO_DOWNLOAD,
                            imageQueues.QNames.IMAGES_TO_PROCESS,
                            imageQueues.QNames.IMAGES_TO_COMPRESS,
                            imageQueues.QNames.DOWNLOADING_IMAGES,
                            imageQueues.QNames.COMPRESSING_IMAGES
    ])){
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
        Persist.outputImageJsonFiles(imageQueues.getItemsFromQueue(imageQueues.QNames.COMPRESSED_IMAGES));
        process.exit(0); // OK I Quit
    }
}



// todo: add to an ImageQueuesProcessing module
const processQueueToCreateFolderStructure = ()=>{
    const imageToDownload = findFirstImageWithState(ImageStates.WILL_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }

    Persist.createFolderStructureForImage(imageToDownload, rootFolder).
    then((image)=>{
        image.setState(ImageStates.AWAITING_DOWNLOAD);
        // no Qs to move
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_DOWNLOAD, imageQueues.QNames.ERROR_PROCESSING_IMAGES)
    });

}

// todo: add to an ImageQueuesProcessing module
const processDownloadImagesQ = ()=>{

    const imageToDownload = findFirstImageWithState(ImageStates.AWAITING_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
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


const processCompressImagesQ = ()=>{

    const imageToCompress = findFirstImageWithState(ImageStates.READY_TO_COMPRESS, imageQueues.QNames.IMAGES_TO_COMPRESS);
    if(imageToCompress==null){
        return;
    }
    imageToCompress.setState(ImageStates.ABOUT_TO_COMPRESS);
    imageQueues.moveFromQToQ(imageToCompress, imageQueues.QNames.IMAGES_TO_COMPRESS, imageQueues.QNames.COMPRESSING_IMAGES);

    CompressImage.compress(imageToCompress).
    then((image)=>{
        imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.COMPRESSED_IMAGES);
        Persist.outputImageJsonFile(image);
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, imageQueues.QNames.COMPRESSING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES)
    });

};


const quitWhenNothingToDoInterval = setInterval(()=>{quitIfQueuesAreEmpty()},1000);
const createFolderStructureQInterval = setInterval(()=>{processQueueToCreateFolderStructure()},100)

// todo: add to an ImageQueuesProcessing module
const downloadImagesQInterval = setInterval(()=>{processDownloadImagesQ()},500)
const compressImagesQInterval = setInterval(()=>{processCompressImagesQ()},1000);
const reportOnImageQsInterval = setInterval(()=>{console.log(imageQueues.reportOnQueueLengths())},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(50)},500);



