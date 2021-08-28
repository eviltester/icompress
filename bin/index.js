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

// todo: we may not need queues, we may be able to rely on the state field in the image object put this behind an abstraction and test
// e.g. it could be queues.findFirstImageWithState(state) which knows which queue to look in for states, then when that works we could remove queues and have a central store and see if it makes a difference, if it didn't then queues would be renamed to images
// todo: add the moveFromQToQ would be on the Queues object, (eventually this might be controlled by setting the state)

const findFirstImageWithState = (desiredState, queue)=>{
    for(image of queue){
        if(image.state==desiredState){
            return image;
        }
    }
    return null;
}


function ImageStatesEnum(){

    this.FETCHING_HEADERS = "FETCHING_HEADERS";
    this.FETCHED_HEADERS = "FETCHED_HEADERS";
    this.SHOULD_DOWNLOAD_EVALUATION = "SHOULD_DOWNLOAD_EVALUATION";
    this.AWAITING_DOWNLOAD = "AWAITING_DOWNLOAD";
    this.ABOUT_TO_DOWNLOAD = "ABOUT_TO_DOWNLOAD";
    this.IGNORED = "IGNORED";
    this.DOWNLOADING = "DOWNLOADING";
    this.DOWNLOADED = "DOWNLOADED";
    this.READY_TO_COMPRESS = "READY_TO_COMPRESS";
    this.ABOUT_TO_COMPRESS = "ABOUT_TO_COMPRESS";
    this.COMPRESSING_VIA_FFMPEG = "COMPRESSING_VIA_FFMPEG";
    this.COMPRESSED_VIA_FFMPEG = "COMPRESSED_VIA_FFMPEG";
    this.COMPRESSING_VIA_IMAGEMAGICK = "COMPRESSING_VIA_IMAGEMAGICK";
    this.COMPRESSED_VIA_IMAGEMAGICK = "COMPRESSED_VIA_IMAGEMAGICK";

    this.ERROR_FETCHING_HEADERS = "ERROR_FETCHING_HEADERS";
    this.ERROR_DOWNLOADING = "ERROR_DOWNLOADING";
    this.ERROR_FFMPEG_COMPRESS = "ERROR_FFMPEG_COMPRESS";
    this.ERROR_IMAGEMAGICK_COMPRESS = "ERROR_IMAGEMAGICK_COMPRESS";
}

const ImageStates = new ImageStatesEnum();

// todo: setImageState and addImageErrorReport should be on an Image class
const setImageState = (image, newState)=>{

    if(image.states==undefined){
        image.states = [];
    }

    console.log(image.src);
    console.log(newState);

    image.state = newState;
    image.states.push(newState);
}

// named 'add' instead of 'set' to allow scope for expanding to multiple error reports in the future e.g. we may have some optional states
const addImageErrorReport = (image, error)=> {
    console.log(error);
    image.errorReport = error;
};



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

        setImageState(img,ImageStates.FETCHING_HEADERS);

        fetch(url, {method: 'HEAD'}).
        then(function(response) {
            setImageState(img,ImageStates.FETCHED_HEADERS);
            console.log(response.headers);
            img.contentLength = response.headers.get('content-length');
            img.type = response.headers.get('Content-Type');
            resolve(img);
        }).
        catch((error)=>{
            setImageState(img,ImageStates.ERROR_FETCHING_HEADERS);
            addImageErrorReport(img, error);
            reject(error);
        });

    });
  }


  function createDir(dir){
    console.log("creating: "  + dir);
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

    setImageState(img, ImageStates.DOWNLOADING)

    console.log("creating dir " +dir);
    // todo: possibly have a state/queue for create imageDir or store output dir in the image as a field?
    createDir(dir);

    return new Promise((resolve, reject) => {
        const downloadTo = dir + "/" + fileName;
        const fileStream = FS.createWriteStream(downloadTo);
        img.fullFilePath = downloadTo;
        fetch(img.src).
        then((response)=>{
            response.body.pipe(fileStream);
            response.body.on("error", reject);
            fileStream.on("finish", resolve);
            setImageState(img, ImageStates.DOWNLOADED)
            resolve(img)
        }).
        catch((error)=>{
            setImageState(img, ImageStates.ERROR_DOWNLOADING);
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

        setImageState(image, ImageStates.SHOULD_DOWNLOAD_EVALUATION);

        if(image.contentLength>=(maxK*1000)){
            setImageState(image, ImageStates.AWAITING_DOWNLOAD);
            forRemoval.push(image);
            downloadQ.push(image);        
        }else{
            setImageState(image, ImageStates.IGNORED);
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

    // todo: queues.areEmpty()
    if(imagesToProcess.length===0 && imagesToCompress.length===0 && imagesToDownload.length===0 && downloadingImages.length===0 && compressingImages.length===0){
        shouldIQuit= true;
        nothingToDoCount++;
    }else{
        nothingToDoCount=0;
    }

    console.log("nothing to do " + nothingToDoCount);

    // add a delay before quiting
    // todo: add a config param for TimesToCheckQueueBeforeExiting
    if(nothingToDoCount<5){
        reportOnQueues();
        return;
    }

    if(shouldIQuit){
        // todo: queues.reportOnQueueCounts()
        reportOnQueues();

        // todo: queues.reportOnQueuesContents()
        console.log("Compressed Images");
        console.log(compressedImages);
        console.log("Ignored Images");  // todo add an ignore reason to the image
        console.log(imagesToLeaveAlone);
        console.log("Error Processing Images")
        console.log(errorProcessingImages);

        process.exit(0); // OK I Quit
    }

},1000);


const downloadImagesQInterval = setInterval(()=>{

    const imageToDownload = findFirstImageWithState(ImageStates.AWAITING_DOWNLOAD, imagesToDownload);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }
    setImageState(imageToDownload, ImageStates.ABOUT_TO_DOWNLOAD);

    moveFromQToQ(imageToDownload, imagesToDownload, downloadingImages);

        console.log(imagesToDownload);
        downloadFile(imageToDownload).
        then(()=>{
            setImageState(imageToDownload, ImageStates.READY_TO_COMPRESS);
            moveFromQToQ(imageToDownload, downloadingImages, imagesToCompress);
        }).
        catch((error)=> {
            setImageState(imageToDownload, ImageStates.ERROR_DOWNLOADING);
            addImageErrorReport(imageToDownload, error)
            moveFromQToQ(imageToDownload, downloadingImages, errorProcessingImages);
        });
    //}
},500)



function ffmpegCompress(imageToFFmpeg, inputFileName, outputFileName) {

    const ffmpeg = 'ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}';

    setImageState(imageToFFmpeg, ImageStates.COMPRESSING_VIA_FFMPEG);
    return new Promise((resolve, reject)=>{
        execParas(ffmpeg, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                setImageState(imageToFFmpeg, ImageStates.COMPRESSED_VIA_FFMPEG);
                imageToFFmpeg.ffmpeg = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToFFmpeg)
            }).catch((error)=> {
                setImageState(imageToFFmpeg, ImageStates.ERROR_FFMPEG_COMPRESS);
                addImageErrorReport(imageToFFmpeg, error)
                reject(imageToFFmpeg);
        })
    });
}

// todo: in the future allow custom commands to be added for images
function imageMagickCompress(imageToCompress, inputFileName, outputFileName) {

    // todo: allow configuration and profiles for image magick
    const imagemagick = 'magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}';

    setImageState(imageToCompress, ImageStates.COMPRESSING_VIA_IMAGEMAGICK);
    return new Promise((resolve, reject)=>{
        execParas(imagemagick, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                setImageState(imageToCompress, ImageStates.COMPRESSED_VIA_IMAGEMAGICK);
                imageToCompress.imagemagick = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToCompress);
            }).catch((error)=> {
                setImageState(imageToCompress, ImageStates.ERROR_IMAGEMAGICK_COMPRESS);
                addImageErrorReport(imageToCompress, error)
                reject(imageToCompress);
        })
    });
}

const moveFromQToQ = (imageToMove, fromQ, toQ)=>{
    toQ.push(imageToMove);
    fromQ.splice(fromQ.indexOf(imageToMove), 1);
}

const processCompressImagesQ = ()=>{

    const imageToCompress = findFirstImageWithState(ImageStates.READY_TO_COMPRESS, imagesToCompress);
    if(imageToCompress==null){
        return;
    }
    setImageState(imageToCompress, ImageStates.ABOUT_TO_COMPRESS);
    moveFromQToQ(imageToCompress, imagesToCompress, compressingImages);

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
};

const compressImagesQInterval = setInterval(()=>{processCompressImagesQ(
                    imagesToCompress, compressingImages, compressedImages, errorProcessingImages)
        },1000);
const reportOnImageQsInterval = setInterval(()=>{reportOnQueues},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(imagesToProcess, imagesToDownload, imagesToLeaveAlone, 50)},500);



