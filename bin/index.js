#!/usr/bin/env node

// http://yargs.js.org/
const yargs = require("yargs");

const exec = require('child_process').exec;

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

//https://nodejs.org/api/timers.html
const { setInterval } = require("timers");

// https://nodejs.org/api/url.html
const Url = require('url').URL;

const ImageQueues = require("./imageQueues.js");

/*
    BUGS:

    TODOs:
    - NEXT
        - output a report of the final state - easier with a queues object - just write the object json.stringify to file
        - add output file paths and output file sizes to the img so that this is in the json output
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
 */


const imageQueues = new ImageQueues();



function ImageStatesEnum(){

    this.FETCHING_HEADERS = "FETCHING_HEADERS";
    this.FETCHED_HEADERS = "FETCHED_HEADERS";
    this.SHOULD_DOWNLOAD_EVALUATION = "SHOULD_DOWNLOAD_EVALUATION";
    this.WILL_DOWNLOAD = "WILL_DOWNLOAD";
    this.CREATING_FOLDERS = "CREATING_FOLDERS";
    this.FILE_SYSTEM_IS_READY = "FILE_SYSTEM_IS_READY";
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
    this.ERROR_CREATING_FOLDERS = "ERROR_CREATING_FOLDERS";
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


const options = yargs
 .usage("Usage: -i <inputfilename> -page <urlForAPageToProcess>")
 .option("i", { alias: "inputname", describe: "Input file name", type: "string", demandOption: false })
 .option("p", { alias: "pageurl", describe: "Url for a page to process", type: "string", demandOption: false })
 .argv;

 if(options.inputname){
    const parsed = Path.parse(options.inputname);
    const fileName = parsed.name;
    const dir = "./" + parsed.dir;    
    imagesToCompress.push({
        src:"local/"+options.inputname,
        fullFilePath:options.inputname,
        state:ImageStates.READY_TO_COMPRESS
    });
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
   fullFilePath // actual file path for the file
   foundOnPage  // url of parent page

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



  function downloadFile(img) {

    setImageState(img, ImageStates.DOWNLOADING)

    return new Promise((resolve, reject) => {
        const downloadTo = img.fileDirPath + Path.sep + img.fileName;
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

if(options.pageurl){

    console.log(options.pageurl)
    // todo build a queue of urls by scanning a site
    getDomFromUrl(options.pageurl).
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
            getImageHeaders(imageUrl)
            .then((img)=>{
                img.foundOnPage = options.pageurl;
                console.log("found image");
                console.log(img);
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

    setImageState(image, ImageStates.SHOULD_DOWNLOAD_EVALUATION);

    if(image.contentLength>=(maxK*1000)){
        setImageState(image, ImageStates.WILL_DOWNLOAD);
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_PROCESS, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    }else{
        setImageState(image, ImageStates.IGNORED);
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_PROCESS, imageQueues.QNames.IMAGES_TO_IGNORE);
    }
}






function outputImageJsonFile(image) {
    //https://nodejs.dev/learn/writing-files-with-nodejs
    try {
        const data = FS.writeFileSync(image.fullFilePath + ".json", JSON.stringify(image, null, 2));
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

let nothingToDoCount=0;

// TODO: make this a separate function which is called by setInterval, rather than all code in the setInterval
const quitWhenNothingToDoInterval = setInterval(()=>{
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
},1000);

function createFolderStructureForImage(image, root) {
    return new Promise((resolve, reject) => {
        try {
            setImageState(image, ImageStates.CREATING_FOLDERS);
            image.rootFolder = root;

            //const urlToParse = img.src;
            const urlToParse = image.foundOnPage;

            // create a page folder
            const pathParts = new Url(urlToParse).pathname.split('/').filter(item => item !="");
            const dir = pathParts.join('_');
            image.dir = dir;

            // create an image name folder
            const fileNamePathParts = new Url(image.src).pathname.split('/');
            const fileName = fileNamePathParts[fileNamePathParts.length - 1];
            image.fileName = fileName;

            console.log("creating dir " + dir);
            // todo: possibly have a state/queue for create imageDir or store output dir in the image as a field?
            image.fileDirPath = image.rootFolder + Path.sep + image.dir + Path.sep + image.fileName;
            createDir(image.fileDirPath);

            setImageState(image, ImageStates.FILE_SYSTEM_IS_READY);
            resolve(image);
        }catch(error){
            setImageState(image, ImageStates.ERROR_CREATING_FOLDERS);
            addImageErrorReport(image, error);
            reject(image);
        }
    });
}

// TODO: make this a separate function which is called by setInterval, rather than all code in the setInterval
const createFolderStructureQInterval = setInterval(()=>{
    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.WILL_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }

    createFolderStructureForImage(imageToDownload, rootFolder).
    then((image)=>{
        setImageState(image, ImageStates.AWAITING_DOWNLOAD);
        // no Qs to move
    }).catch((image)=>{
        imageQueues.moveFromQToQ(image, imageQueues.QNames.IMAGES_TO_DOWNLOAD, imageQueues.QNames.ERROR_PROCESSING_IMAGES)
    });

},100);

// TODO: make this a separate function which is called by setInterval, rather than all code in the setInterval
const downloadImagesQInterval = setInterval(()=>{

    const imageToDownload = imageQueues.findFirstImageWithState(ImageStates.AWAITING_DOWNLOAD, imageQueues.QNames.IMAGES_TO_DOWNLOAD);
    if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
        return;
    }
    setImageState(imageToDownload, ImageStates.ABOUT_TO_DOWNLOAD);

    imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.IMAGES_TO_DOWNLOAD, imageQueues.QNames.DOWNLOADING_IMAGES);

        console.log(imageQueues.reportOnQueueContents(imageQueues.QNames.IMAGES_TO_DOWNLOAD));
        downloadFile(imageToDownload).
        then(()=>{
            setImageState(imageToDownload, ImageStates.READY_TO_COMPRESS);
            imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.DOWNLOADING_IMAGES, imageQueues.QNames.IMAGES_TO_COMPRESS);
        }).
        catch((error)=> {
            setImageState(imageToDownload, ImageStates.ERROR_DOWNLOADING);
            addImageErrorReport(imageToDownload, error)
            imageQueues.moveFromQToQ(imageToDownload, imageQueues.QNames.DOWNLOADING_IMAGES, imageQueues.QNames.ERROR_PROCESSING_IMAGES);
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


const processCompressImagesQ = ()=>{

    const imageToCompress = imageQueues.findFirstImageWithState(ImageStates.READY_TO_COMPRESS, imageQueues.QNames.IMAGES_TO_COMPRESS);
    if(imageToCompress==null){
        return;
    }
    setImageState(imageToCompress, ImageStates.ABOUT_TO_COMPRESS);
    imageQueues.moveFromQToQ(imageToCompress, imageQueues.QNames.IMAGES_TO_COMPRESS, imageQueues.QNames.COMPRESSING_IMAGES);

    const writtenImagePath = Path.parse(imageToCompress.fullFilePath);
    const pathPrefix = "./";

    // possibly use Path.relative() with "./" or preocess.cwd()
    const inputFileName = pathPrefix + imageToCompress.fullFilePath;
    const outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
    const compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.fileName;

    if(AnimatedGifDetector(FS.readFileSync(imageToCompress.fullFilePath))){

        ffmpegCompress(imageToCompress, inputFileName, outputFileName)
            .then((image)=> {
                imageMagickCompress(image, outputFileName, compressedFileName)
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

const compressImagesQInterval = setInterval(()=>{processCompressImagesQ()},1000);
const reportOnImageQsInterval = setInterval(()=>{console.log(imageQueues.reportOnQueueLengths())},500);
const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(50)},500);



