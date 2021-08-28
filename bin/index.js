#!/usr/bin/env node

const yargs = require("yargs");
const util = require('util');
//const exec = util.promisify(require('child_process').exec);
const exec = require('child_process').exec;

const FS = require('fs');
const Path = require('path');

// https://www.npmjs.com/package/animated-gif-detector
const AnimatedGifDetector = require('animated-gif-detector');

const fetch = require('isomorphic-fetch');

const jsdom = require("jsdom");
const { setInterval } = require("timers");
const { dirxml } = require("console");
const { JSDOM } = jsdom;
const Url = require('url').URL;


// todo: create folder for the url then image folders below that for each image
// todo: tidy the code

// todo: this could be a queues object
const imagesToProcess = []; // found images
const imagesToDownload = []; // images which are big enough to process and download them
const downloadingImages = []; // images we are currently downloading
const imagesToCompress = []; // images which we need to compress
const compressingImages = [];
const imagesToLeaveAlone = []; // images which we need to compress
const compressedImages = [];
const errorProcessingImages = [];



const options = yargs
 .usage("Usage: -i <inputfilename> -page <urlForAPageToProcess>")
 .option("i", { alias: "inputname", describe: "Input file name", type: "string", demandOption: false })
 .option("p", { alias: "pageurl", describe: "Url for a page to process", type: "string", demandOption: false })
 .argv;

 if(options.inputname){

    const parsed = Path.parse(options.inputname);
    const fileName = parsed.name;
    const dir = "./" + parsed.dir;    
    imagesToCompress.push({src:"local/"+options.inputname,fileName:options.inputname, path:"."});

 }




function execPromise(command) {
    return new Promise(function(resolve, reject) {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            resolve(stdout.trim());
        });
    });
}


function execParas(commandLineTemplate, params) {

    // params is an object where each field is a param
    const paramNames = Object.getOwnPropertyNames(params);
    let commandLine = commandLineTemplate;

    for(const paramName of paramNames){
        commandLine = commandLine.split("${"+paramName+"}").join(params[paramName]);// parse the string and replace the template variables
    }

    console.log(commandLine);

    return new Promise((resolve, reject) => {

        execPromise(commandLine).
        then((result)=>{console.log('stdout:', result);
                        resolve(result)})
        .catch((error)=>{
            console.error('stderr:', error);
            reject(error)
        });
    }
    );
  }


// TODO: start making image an object/class
// TODO: maintain an list of historical states in the image as well as a current state

/*


image:
   src // download url from src attribute
   contentLength // header reported by server
   type // type reported by server
   dir  // directory plan to write to
   fileName // planned filename to use
   fullPath // actual file path for the file


*/

// https://www.npmjs.com/package/jsdom
// https://medium.com/@bretcameron/how-to-build-a-web-scraper-using-javascript-11d7cd9f77f2


function getImageHeaders(url) {

    const img = {src:url};

    return new Promise((resolve, reject) => {

        fetch(url, {method: 'HEAD'}).
        then(function(response) {
            img.contentLength = response.headers.get('content-length');
            img.type = response.headers.get('Content-Type');
            console.log(response.headers);
            console.log(img);
            console.log(response.headers.get('content-length'));
            console.log(response.headers.get('Content-Type'));
            resolve(img);
        }).
        catch((error)=>{
                        img.errorReport = error;
                        console.error('stderr:', error.stderr);
                        reject(error);
                    });

    });
  }


  function createDir(dir){
    console.log("creating: " +dir);
      console.log(dir)
    try {
        if (!FS.existsSync(dir)) {
            FS.mkdirSync(dir);
        }
    } catch (err) {
        console.error(err);
    }
  }

  function downloadFile(img) {


    const pathParts = new Url(img.src).pathname.split('/');
    const dir = pathParts.join('_');
    const fileName = pathParts[pathParts.length-1];
    img.dir = dir;
    img.fileName = fileName;

    console.log("downloading");
    console.log(img);

    console.log("creating dir " +dir);
    createDir(dir);

    img.state="DOWNLOADING";

    return new Promise((resolve, reject) => {
        const downloadTo = dir + "/" + fileName;
        const fileStream = FS.createWriteStream(downloadTo);
        img.fullFilePath = downloadTo;
        fetch(img.src).
        then((response)=>{
            response.body.pipe(fileStream);
            response.body.on("error", reject);
            fileStream.on("finish", resolve);
            img.state="DOWNLOADED";
            resolve(img)
        }).
        catch((error)=>{
            img.state="ERROR_DOWNLOADING";
                        console.error('stderr:', error.stderr);
                        reject(error);
                    });

    });

  }  

function getDomFromUrl(url){


    console.log("Getting "  + url);

    return new Promise((resolve, reject) => {

        fetch(url).then((response) =>{            
            return response.text();
        }).then((text)=>{
            resolve(new JSDOM(text))
        }).catch((error)=>{
            console.log("could not get " + url);
            console.log(error);
            reject(error);
        })
    });
}

// given a page
// get the source and find all images
// get all images and download those which are > 50K based on header to a folder



console.log(options)
if(options.pageurl){

    console.log(options.pageurl)
    // todo build a queue of urls by scanning a site
    getDomFromUrl(options.pageurl).
    then((dom)=>{
        const imgs=dom.window.document.querySelectorAll("img");
        for(imageNode of imgs){
            let imageUrl = imageNode.getAttribute("src");
            let divider = "";
            if(!imageUrl.startsWith("/")){
                divider = "/";
            }
            if(!imageUrl.includes(":/")){
                // image is relative
                imageUrl = options.pageurl + divider + imageUrl;
            }
            getImageHeaders(imageUrl)
            .then((img)=>{
                console.log("found image");
                console.log(img);
                imagesToProcess.push(img);
            }).catch((error)=>{console.log("image error"); console.log(error)});    
        }

    }).catch((error)=>{
        console.log("processing error");
        console.log(error);
    });
}




function filterImagesAndAddToDownloadQueue(processQ, downloadQ, ignoreQ, maxK){
    const forRemoval= [];

    for(image of processQ){
        if(image.contentLength>=(maxK*1000)){
            image.state="AWAITING_DOWNLOAD";
            forRemoval.push(image);
            downloadQ.push(image);        
        }else{
            image.state="IGNORED";
            ignoreQ.push(image);
            forRemoval.push(image);
        }
    }
    forRemoval.map(img => processQ.splice(processQ.indexOf(img), 1));
}


const reportOnQueues = function(){
    console.log(
        `To Process: ${imagesToProcess.length}
To Download: ${imagesToDownload.length}
Downloading: ${downloadingImages.length}
To Compress: ${imagesToCompress.length}
Compressing: ${compressingImages.length}
Done: ${compressedImages.length}
Ignored: ${imagesToLeaveAlone.length}
Errors: ${errorProcessingImages.length}`);
}




let nothingToDoCount=0;

const quitWhenNothingToDoInterval = setInterval(()=>{
    let shouldIQuit = false;

    if(imagesToProcess.length===0 && imagesToCompress.length===0 && imagesToDownload.length===0 && downloadingImages.length===0 && compressingImages.length===0){
        shouldIQuit= true;
        nothingToDoCount++;
    }else{
        nothingToDoCount=0;
    }

    console.log("nothing to do " + nothingToDoCount);

    // add a delay before quiting
    if(nothingToDoCount<10){
        reportOnQueues();
        return;
    }

    if(shouldIQuit){
        reportOnQueues();

        console.log("Compressed Images");
        console.log(compressedImages);
        console.log("Ignored Images");  // todo add an ignore reason to the image
        console.log(imagesToLeaveAlone);
        console.log("Error Processing Images")
        console.log(errorProcessingImages); // todo add an error reason to the image

        process.exit(0); // OK I Quit
    }

},1000);

const findFirstImageWithState = (desiredState, queue)=>{
    for(image of queue){
        if(image.state==desiredState){
            return image;
        }
    }
    return null;
}

const downloadImagesQInterval = setInterval(()=>{

    const imageToDownload = findFirstImageWithState("AWAITING_DOWNLOAD", imagesToDownload);
    if(imageToDownload==null){
        return;
    }
    imageToDownload.state="ABOUT_TO_DOWNLOAD";

        imagesToDownload.splice(imagesToDownload.indexOf(imageToDownload), 1);
        downloadingImages.pop(imageToDownload);
        console.log("about to download");
        console.log(imagesToDownload);
        downloadFile(imageToDownload).
        then(()=>{
            console.log("downloaded ");
            console.log(imageToDownload);
            imageToDownload.state="READY_TO_COMPRESS";
            imagesToCompress.push(imageToDownload);
            downloadingImages.splice(downloadingImages.indexOf(imageToDownload),1);
        }).catch((error)=>
            {console.log("Error downloading ");
             console.log(error);
             imageToDownload.errorReport = error;
             errorProcessingImages.push(imageToDownload);
             downloadingImages.splice(downloadingImages.indexOf(imageToDownload),1);
            });
    //}
},500)

const ffmpeg = 'ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}';

function ffmpegCompress(imageToFFmpeg, inputFileName, outputFileName) {
    console.log("compressing using ffmpeg ");
    imageToFFmpeg.state="COMPRESSING_VIA_FFMPEG";
    return new Promise((resolve, reject)=>{
        execParas(ffmpeg, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                console.log("compressed via ffmpeg ");
                imageToFFmpeg.state="COMPRESSED_VIA_FFMPEG";
                console.log(imageToFFmpeg);
                imageToFFmpeg.ffmpeg = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToFFmpeg)
            }).catch((error)=> {
            console.log("error during ffmpeg compress");
            imageToFFmpeg.errorReport = error;
            reject(imageToFFmpeg);
        })
    });
}

// thought I needed timing sync between file writes, but actually
// I needed to add const in front of variables to make them scoped
// rather than creating globals which get overwritten by other parts of the code!
function wait(milliseconds) {
    console.log("Waiting...")
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const imagemagick = 'magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}';

function imageMagickCompress(imageToCompress, inputFileName, outputFileName) {
    console.log("compressing using imagemagick ");
    imageToCompress.state="COMPRESSING_VIA_IMAGEMAGICK";
    return new Promise((resolve, reject)=>{
        execParas(imagemagick, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                imageToCompress.state="COMPRESSED_VIA_IMAGEMAGICK";
                console.log("compressed ");
                console.log(imageToCompress);
                imageToCompress.imagemagick = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToCompress);
            }).catch((error)=> {
                console.log("error during imagemagick compress");
                imageToCompress.errorReport = error;
                reject(imageToCompress);
        })
    });
}

/*
    async is basically a promise where the resolve is the return value and the reject is the exception
 */
const moveFromQToQ = async (imageToMove, fromQ, toQ)=>{
    try {
        toQ.push(imageToMove);
        fromQ.splice(fromQ.indexOf(imageToMove), 1);
    }catch(error){
        console.log("failure to move " + error);
        throw imageToMove;
    }
};

const processCompressImagesQ = ()=>{

    const imageToCompress = findFirstImageWithState("READY_TO_COMPRESS", imagesToCompress);
    if(imageToCompress==null){
        return;
    }
    imageToCompress.state="ABOUT_TO_COMPRESS";

        imagesToCompress.splice(imagesToCompress.indexOf(imageToCompress), 1);
        compressingImages.pop(imageToCompress);
        console.log("about to compress");
        console.log(imageToCompress);


        const writtenImagePath = Path.parse(imageToCompress.fullFilePath);
        const pathPrefix = "./";

        // possibly use Path.relative() with "./" or preocess.cwd()
        const inputFileName = pathPrefix + imageToCompress.fullFilePath;
        const outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
        const compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.fileName;

        createDir(pathPrefix + writtenImagePath.dir);

        if(AnimatedGifDetector(FS.readFileSync(imageToCompress.fullFilePath))){

            ffmpegCompress(imageToCompress, inputFileName, outputFileName)
                .then((image)=> {
                    imageMagickCompress(image, outputFileName, compressedFileName)
                    .then((image)=> {moveFromQToQ(image, compressingImages, compressedImages)})
                    .catch((image)=>{moveFromQToQ(image, compressingImages, errorProcessingImages)});
                })
                .catch((image)=>{moveFromQToQ(image, compressingImages, errorProcessingImages)});

        }else{
            // just apply image magic
            imageMagickCompress(imageToCompress, inputFileName, compressedFileName).
            then((image)=>{moveFromQToQ(image, compressingImages, compressedImages)}).
            catch((image)=>{moveFromQToQ(image, compressingImages, errorProcessingImages)});
        }
    //}
};

const compressImagesQInterval = setInterval(()=>{processCompressImagesQ(
                    imagesToCompress, compressingImages, compressedImages, errorProcessingImages)
        },1000);
const reportOnImageQsInterval = setInterval(()=>{reportOnQueues},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(imagesToProcess, imagesToDownload, imagesToLeaveAlone, 50)},500);



