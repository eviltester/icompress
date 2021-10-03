#!/usr/bin/env node

const Shell = require("../src/shell/commandLineExec");

// http://yargs.js.org/
const yargs = require("yargs");

// https://nodejs.org/api/fs.html
const FS = require('fs');

//https://nodejs.org/api/path.html
const Path = require('path');

const HTTP = require("../src/http/httpWrapper");

//https://nodejs.org/api/timers.html
const { setInterval } = require("timers");

// https://nodejs.org/api/url.html
const Url = require('url').URL;

const PageQueues = require("../src/queues/pageQueues");
const ImageQueues = require("../src/queues/imageQueues.js");
const ImageDetails = require("../src/domain/imageDetails");
const ImageStates = ImageDetails.States;

const Persist = require("../src/persistence/imagePersistence");

const Compress = require("../src/compression/imageCompression");

const QueueBasedScanner = require("../src/app/queueBasedScanner");

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















// https://www.npmjs.com/package/sitemapper
// for reading sitemaps
const Sitemapper = require('sitemapper');
const sitemap = new Sitemapper();

/*

    WIP:

    BUGS:

    TODOs:
    - NEXT
        - scan folder of images rather than urls and create a mirror folder with compressed images for local work
        - GUI to setup the Qs and show Qs in Action to trigger from single image, url
    - typescript?
    - add tests for the modules and classes
    - configuration and defaults for hard coded values
    - spidering
        - evaluate existing node.js spiders to see if there is something configurable that supports plugins then our image processing could be a plugin
        - scan a url and crawl for all pages, then evaluate for images - create objects for page, urls to scan etc.
        - image processing should be a 'task' to apply on pages to support future expansion of spider
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
 .usage("Usage: -i <inputfilename> -p <urlForAPageToProcess> -x <sitemapurl>")
 .option("i", { alias: "inputname", describe: "Input file name", type: "string", demandOption: false })
 .option("p", { alias: "pageurl", describe: "Url for a page to process", type: "string", demandOption: false })
 .option("x", { alias: "xmlsitemap", describe: "XML Sitemap to scan for pages to process", type: "string", demandOption: false})
 .option("f", { alias: "forceactions", describe: "Force actions to be redone from a list i.e. headers,download,compressffmpeg,compressmagick", type: "string", demandOption: false})
 .argv;



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
    rootFolder = Persist.createDirForUrlHostname(aUrl);
}


const scanner = new QueueBasedScanner.Scanner(rootFolder, forceactions);


// process a single file
if(options.inputname){

    const parsed = Path.parse(options.inputname);
    const fileName = parsed.name;
    const dir = "./" + parsed.dir;

    const inputImage = new ImageDetails.Image();
    inputImage.setSrc(Persist.combineIntoPath("local"+options.inputname));
    inputImage.setFullFilePath(options.inputname);
    inputImage.setOriginalFileName(fileName);
    inputImage.setState(ImageStates.READY_TO_COMPRESS);

    // todo: if there were other options e.g. -p or -x then we should add it to the queue and let the queues do the work
    // imageQManager.addImageToCompressQueue(inputImage);
    // but...since this is a single file, we can just await the compression code
    (async() => {
        console.log('about to compress single file');
        await Compress.compress(inputImage, true, true);
        console.log('compressed ' + fileName);
        process.exit(0);
    })();

}




/*
    Started
 */

// given a page
// get the source and find all images
// get all images and download those which are > 50K based on header to a folder
if(options.pageurl){
    scanner.addPageToScan(options.pageurl);
}

// given a sitemap add all the pages to the Q
// todo: create a processSiteMapQ to allow scanning sitemaps and multiple sitemaps
if(options.xmlsitemap){
    sitemap.fetch(options.xmlsitemap).
    then(function(sites) {
        sites.sites.forEach((siteUrl)=> {
            scanner.addPageToScan(options.pageurl);
            }
        );
    }).catch((error)=> {
        console.log("Error Reading Sitemap from " + options.xmlsitemap);
    console.log(error);
    });
}

// todo: add to ExitBasedOnQueues class
let nothingToDoCount=0;

// todo: include page processing queues here too
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
        process.exit(0); // OK I Quit
    }
}


const quitWhenNothingToDoInterval = setInterval(()=>{quitIfQueuesAreEmpty()},1000);







scanner.startQueueProcessing();


