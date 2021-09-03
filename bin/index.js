#!/usr/bin/env node

const Shell = require("./commandLineExec.js");

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

const ImageHTTP = require("./imageHttp");

const Queues = require("./qManager");
const Page = require("./page");
const PageQueues = require("./pageQueues.js");
const ImageQueues = require("./imageQueues.js");
const ImageDetails = require("./imageDetails.js");
const ImageStates = ImageDetails.States;

const CompressImage = require("./imageCompression");
const Persist = require("./imagePersistence");

const ImageQNames = Object.getOwnPropertyNames(ImageQueues.QueueNames);
const imageQueues = new Queues.QManager(ImageQNames);


// https://www.npmjs.com/package/sitemapper
const Sitemapper = require('sitemapper');
const sitemap = new Sitemapper();

/*

    WIP:
        - refactoring out into classes

    BUGS:

    TODOs:
    - NEXT
        - split code into modules and classes
    - typescript?
    - add tests for the modules and classes
    - configuration and defaults for hard coded values
    - spidering
        - evaluate existing node.js spiders to see if there is something configurable that supports plugins then our image processing could be a plugin
        - scan a url and crawl for all pages, then evaluate for images - create objects for page, urls to scan etc.
        - image processing should be a 'task' to apply on pages to support future expansion of spider
    - scan folder of images rather than urls and create a mirror folder with compressed images for local work
    - GUI/App to make it easier e.g. add url, scan, save progress, interrupt and restart, rescan etc.
    - create a report as html to make it easy to view the output and the original and compressed files i.e open in new tab
 */




/*
    Startup
 */


// todo: have a 'retry' for any of the images in an output state file which were in an 'error' state and pick up from the last valid state
// todo: add an output folder option rather than always using the current folder
// todo: given a file with a list of page urls, process those
// todo: have a -scan method which only does the 'head' and reports on what should be downloaded and what should be ignored but does not actually download or compress
// todo build a queue of urls by scanning a site
// todo: investigate why we don't stop on Promise.allSettled
// todo: -f to force headers - this requires loading in the json file if it exists and clearing the commands if compressffmpeg and compressmagick are forced
// todo: add more default compression commands
// todo: allow user configure the compression commands

Shell.exitIfCliToolNotInstalled("ffmpeg", "ffmpeg -version", "https://www.ffmpeg.org");
Shell.exitIfCliToolNotInstalled("imagemagick", "magick -version", "https://imagemagick.org");


const options = yargs
 .usage("Usage: -i <inputfilename> -page <urlForAPageToProcess>")
 .option("i", { alias: "inputname", describe: "Input file name", type: "string", demandOption: false })
 .option("p", { alias: "pageurl", describe: "Url for a page to process", type: "string", demandOption: false })
 .option("x", { alias: "xmlsitemap", describe: "XML Sitemap to scan for pages to process", type: "string", demandOption: false})
 .option("f", { alias: "forceactions", describe: "Force actions to be redone from a list i.e. headers,download,compressffmpeg,compressmagick", type: "string", demandOption: false})
 .argv;

 if(options.inputname){
    const parsed = Path.parse(options.inputname);
    const fileName = parsed.name;
    const dir = "./" + parsed.dir;
    const inputImage = new ImageDetails.Image();
    inputImage.setSrc(Persist.combineIntoPath("local"+options.inputname));
    inputImage.setFullFilePath(options.inputname);
    inputImage.setState(ImageStates.READY_TO_COMPRESS);
    imagesToCompress.push(inputImage);
 }

const forceactions = {download: false, compressffmpeg: false, compressmagick:false};

if(options.forceactions){
    const actionsToForce = options.forceactions.split(",");
    for(actionToForce of actionsToForce){
        forceactions[actionToForce]=true;
    }
}

// if we are given a url then create a root folder using the domain name
let rootFolder = "";
if(options.pageurl){
    createDirForUrl(options.pageurl);
}

function createDirForUrl(aUrl){
    const givenPageUrl = new Url(aUrl);
    rootFolder = givenPageUrl.hostname;
    Persist.createDir(rootFolder);
}

/*
    Started
 */

// given a page
// get the source and find all images
// get all images and download those which are > 50K based on header to a folder



const PageQNames = Object.getOwnPropertyNames(PageQueues.QueueNames);
const pageQueues = new Queues.QManager(PageQNames);


function createImageFromUrl(anImageUrl, aPageUrl){
    return new Promise((resolve, reject) => {

        const img = new ImageDetails.Image();
        img.setSrc(anImageUrl);
        img.setFoundOnPageUrl(aPageUrl);

        // todo: check if json file has been downloaded if so we don't need to reprocess headers unless forced to

        ImageHTTP.getImageHeaders(img)
            .then((img) => {
                imageQueues.addToQueue(img, ImageQueues.QueueNames.IMAGES_TO_PROCESS);
                resolve(img);
            }).catch((errorDetails) => {
                imageQueues.addToQueue(img, ImageQueues.QueueNames.ERROR_PROCESSING_IMAGES);
                console.log("image error");
                console.log(errorDetails.error)
                reject(errorDetails.image)
        });
    });
}

if(options.pageurl){
    queueUpThePageURL(options.pageurl);
}

if(options.xmlsitemap){
    sitemap.fetch(options.xmlsitemap).
    then(function(sites) {
        sites.sites.forEach((siteUrl)=>queueUpThePageURL(siteUrl));
    }).catch((error)=> {
        console.log("Error Reading Sitemap from " + options.xmlsitemap);
    console.log(error);
    });
}

function queueUpThePageURL(aUrl){
    const page = new Page.Page(aUrl);
    console.log(aUrl)

    page.getDom().
    then((page)=>{
        createDirForUrl(aUrl);
        pageQueues.addToQueue(page, PageQueues.QueueNames.READY_TO_SCAN);
    }).catch((error)=>{
        pageQueues.addToQueue(page, PageQueues.QueueNames.ERROR_PROCESSING_PAGES);
        console.log("processing error");
        console.log(error);
    });
}


imageQueues.findFirstImageWithState = (state, qName) => {
    return imageQueues.findFirstInQWhere(qName, (image) => {return image.getState()==state})
}

function findFirstPageWithState(state, qName){
    return pageQueues.findFirstInQWhere(qName, (page) => {return page.getState()==state})
}

const processPageQueueToScan = ()=>{

    const page = findFirstPageWithState(Page.States.FOUND, PageQueues.QueueNames.READY_TO_SCAN);
    if(page==null){ // nothing in the Queue waiting to be scanned
        return;
    }
    page.setState(Page.States.SCANNING);
    pageQueues.moveFromQToQ(page, PageQueues.QueueNames.READY_TO_SCAN, PageQueues.QueueNames.SCANNING);

    const imageScanningPromises = [];

    const imageUrls = page.getAllImageUrlsFromDom();
    for(const imageUrl of imageUrls){
        imageScanningPromises.push(createImageFromUrl(imageUrl, page.getUrl()));
    }

    // wait for all createImageFromUrl promises to resolve before setting state for page and moving to scanned
    //Promise.allSettled(imageScanningPromises).then((values) => {
        page.setState(Page.States.SCANNED);
        pageQueues.moveFromQToQ(page, PageQueues.QueueNames.SCANNING, PageQueues.QueueNames.SCANNED);
    //});

}


function filterImagesAndAddToDownloadQueue(maxK){

    const image = imageQueues.findFirstImageWithState(ImageStates.FETCHED_HEADERS, ImageQueues.QueueNames.IMAGES_TO_PROCESS);
    if(image==null){
        return;
    }

    image.setState(ImageStates.SHOULD_DOWNLOAD_EVALUATION);

    if(image.getContentLength()>=(maxK*1000)){
        image.setState(ImageStates.WILL_DOWNLOAD);
        imageQueues.moveFromQToQ(image, ImageQueues.QueueNames.IMAGES_TO_PROCESS, ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD);
    }else{
        image.setState(ImageStates.IGNORED);
        imageQueues.moveFromQToQ(image, ImageQueues.QueueNames.IMAGES_TO_PROCESS, ImageQueues.QueueNames.IMAGES_TO_IGNORE);
    }
}




// todo: add to ExitBasedOnQueues module
let nothingToDoCount=0;

// todo: include page processing queues here too
const quitIfQueuesAreEmpty = ()=>{
    let shouldIQuit = false;

    if(imageQueues.allGivenQueuesAreEmpty([
                            ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD,
                            ImageQueues.QueueNames.IMAGES_TO_PROCESS,
                            ImageQueues.QueueNames.IMAGES_TO_COMPRESS,
                            ImageQueues.QueueNames.DOWNLOADING_IMAGES,
                            ImageQueues.QueueNames.COMPRESSING_IMAGES
    ]) &&
        pageQueues.allGivenQueuesAreEmpty([
                        PageQueues.QueueNames.READY_TO_SCAN,
                        PageQueues.QueueNames.SCANNING
        ])
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
        console.log(pageQueues.reportOnQueueLengths());
        console.log("Image Queues");
        console.log("------------");
        console.log(imageQueues.reportOnQueueLengths());
        return;
    }

    if(shouldIQuit){
        console.log(pageQueues.reportOnQueueLengths());
        console.log(pageQueues.reportOnAllQueueContents())

        console.log(imageQueues.reportOnQueueLengths());
        console.log(imageQueues.reportOnAllQueueContents())
        Persist.outputImageJsonFiles(imageQueues.getItemsFromQueue(ImageQueues.QueueNames.COMPRESSED_IMAGES));
        process.exit(0); // OK I Quit
    }
}



// todo: add to an ImageQueuesProcessing module
const processQueueToCreateFolderStructure = ()=>{
    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.WILL_DOWNLOAD, ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }

    Persist.createFolderStructureForImage(imageToDownload, rootFolder).
    then((image)=>{
        image.setState(ImageStates.AWAITING_DOWNLOAD);
        // no Qs to move
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD, ImageQueues.QueueNames.ERROR_PROCESSING_IMAGES)
    });

}

// todo: add to an ImageQueuesProcessing module
const processDownloadImagesQ = ()=>{

    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.AWAITING_DOWNLOAD, ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }

    imageToDownload.setState(ImageStates.ABOUT_TO_DOWNLOAD);
    imageQueues.moveFromQToQ(imageToDownload, ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD, ImageQueues.QueueNames.DOWNLOADING_IMAGES);

    console.log(imageQueues.reportOnQueueContents(ImageQueues.QueueNames.IMAGES_TO_DOWNLOAD));
    ImageHTTP.downloadImageFile(imageToDownload, forceactions.download).
    then(()=>{
        imageToDownload.setState(ImageStates.READY_TO_COMPRESS);
        imageQueues.moveFromQToQ(imageToDownload, ImageQueues.QueueNames.DOWNLOADING_IMAGES, ImageQueues.QueueNames.IMAGES_TO_COMPRESS);
    }).
    catch((error)=> {
        imageToDownload.setState(ImageStates.ERROR_DOWNLOADING);
        imageToDownload.addErrorReport(error);
        imageQueues.moveFromQToQ(imageToDownload, ImageQueues.QueueNames.DOWNLOADING_IMAGES, ImageQueues.QueueNames.ERROR_PROCESSING_IMAGES);
    });

}


const processCompressImagesQ = ()=>{

    const imageToCompress = imageQueues.findFirstImageWithState(ImageStates.READY_TO_COMPRESS, ImageQueues.QueueNames.IMAGES_TO_COMPRESS);
    if(imageToCompress==null){
        return;
    }
    imageToCompress.setState(ImageStates.ABOUT_TO_COMPRESS);
    imageQueues.moveFromQToQ(imageToCompress, ImageQueues.QueueNames.IMAGES_TO_COMPRESS, ImageQueues.QueueNames.COMPRESSING_IMAGES);

    CompressImage.compress(imageToCompress, forceactions.compressffmpeg, forceactions.compressmagick).
    then((image)=>{
        imageQueues.moveFromQToQ(image, ImageQueues.QueueNames.COMPRESSING_IMAGES, ImageQueues.QueueNames.COMPRESSED_IMAGES);
        Persist.outputImageJsonFile(image);
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, ImageQueues.QueueNames.COMPRESSING_IMAGES, ImageQueues.QueueNames.ERROR_PROCESSING_IMAGES)
    });

};


const quitWhenNothingToDoInterval = setInterval(()=>{quitIfQueuesAreEmpty()},1000);

const pageProcessingQInterval = setInterval(()=>{processPageQueueToScan()},100);
const reportOnPageQsInterval = setInterval(()=>{console.log(pageQueues.reportOnQueueLengths())},500);

const createFolderStructureQInterval = setInterval(()=>{processQueueToCreateFolderStructure()},100)






// todo: add to an ImageQueuesProcessing module
const downloadImagesQInterval = setInterval(()=>{processDownloadImagesQ()},500)
const compressImagesQInterval = setInterval(()=>{processCompressImagesQ()},1000);
const reportOnImageQsInterval = setInterval(()=>{console.log(imageQueues.reportOnQueueLengths())},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(50)},500);



