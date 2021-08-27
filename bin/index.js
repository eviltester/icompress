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
                return;
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

// todo this could be an execWithParams promise
// function ffmpegCompress(inputFileName, outputFileName) {
//     return new Promise((resolve, reject) => {

//         const ffmpeg = `ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}`;
//         console.log(ffmpeg);

//         execPromise(ffmpeg).
//         then((result)=>{console.log('stdout:', result);
//                         resolve(result)})
//         .catch((error)=>{
//             console.error('stderr:', error);
//             reject(error)
//         });
//     }
//     );
//   }


// function imageMagickCompress(inputFileName, outputFileName) {
//     return new Promise((resolve, reject) => {
//         const imagemagick = `magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}`;
//         console.log(imagemagick);

//         execPromise(imagemagick).
//         then((result)=>{
//             console.log('imagemagick stdout:', result);
//             resolve(result);
//             })
//         .catch((error)=>{
//             console.error('stderr:', error.stderr);
//             reject(error);
//         });
//     });
//   }

// old code to process the input file
//
// const dirname = path.parse(options.inputname).name;
// const dir = "./" + dirname;

// // wrap this in a promise so that we can chain creating dirs with executing apps
// console.log("outputing files to: " + dir);
// try {
//     if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir);
//     }
// } catch (err) {
//     console.error(err);
// }

// const outputDir = dir + "/";
// const inputFileToFFmpeg = `${options.inputname}`;
// const outputFileFromFFmpeg = `${outputDir}ffmpeg-output-${options.inputname}`;
// const outputFileFromImageMagick = `${outputDir}imgmagic-output-${options.inputname}`;

// console.log("Executing:");





// ffmpegCompress(inputFileToFFmpeg, outputFileFromFFmpeg)
// .then((result)=>{imageMagickCompress(outputFileFromFFmpeg, outputFileFromImageMagick)})
// .catch((()=>{console.log("Error During Processing")}));

// execParas(ffmpeg, {inputFileName: inputFileToFFmpeg, outputFileName: outputFileFromFFmpeg})
// .then((result)=>{execParas(imagemagick, {inputFileName: outputFileFromFFmpeg, outputFileName: outputFileFromImageMagick})})
// .catch((()=>{console.log("Error During Processing")}));




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

    return new Promise((resolve, reject) => {
        const downloadTo = dir + "/" + fileName;
        const fileStream = FS.createWriteStream(downloadTo);
        img.fullFilePath = downloadTo;
        fetch(img.src).
        then((response)=>{
            response.body.pipe(fileStream);
            response.body.on("error", reject);
            fileStream.on("finish", resolve);
            resolve(img)
        }).
        catch((error)=>{
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
    // todo build a queue
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
            forRemoval.push(image);
            downloadQ.push(image);        
        }else{
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

const reportOnImageQsInterval = setInterval(()=>{reportOnQueues},1000);


const quitWhenNothingToDoInterval = setInterval(()=>{
    let shouldIQuit = false;

    if(imagesToProcess.length===0 && imagesToCompress.length===0 && imagesToDownload.length===0 && downloadingImages.length===0 && compressingImages.length===0){
        shouldIQuit= true;
    }

    if(shouldIQuit){
        reportOnQueues();

        console.log("Ignored Images");  // todo add an ignore reason to the image
        console.log(imagesToLeaveAlone);
        console.log("Error Processing Images")
        console.log(errorProcessingImages); // todo add an error reason to the image

        process.exit(0); // OK I Quit
    }

},1000);

const addImagesToDownloadQInterval = setInterval(()=>{filterImagesAndAddToDownloadQueue(imagesToProcess, imagesToDownload, imagesToLeaveAlone, 50)},500);

const downloadImagesQInterval = setInterval(()=>{
    if(imagesToDownload.length>0){
        imageToDownload = imagesToDownload.shift();
        downloadingImages.pop(imageToDownload);
        console.log("about to download");
        console.log(imagesToDownload);
        downloadFile(imageToDownload).
        then(()=>{
            console.log("downloaded ");
            console.log(imageToDownload);
            imagesToCompress.push(imageToDownload);
            downloadingImages.splice(downloadingImages.indexOf(imageToDownload),1);
        }).catch((error)=>
            {console.log("Error downloading ");
             console.log(error);
             imageToDownload.errorReport = error;
             errorProcessingImages.push(imageToDownload);
             downloadingImages.splice(downloadingImages.indexOf(imageToDownload),1);
            });
    }
},500)

const ffmpeg = 'ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}';

function ffmpegCompress(imageToCompress, inputFileName, outputFileName) {
    return new Promise((resolve, reject)=>{
        execParas(ffmpeg, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                console.log("compressed " + imageToCompress);
                imageToCompress.ffmpeg = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToCompress)
            }).catch((error)=> {
            console.log("error during ffmpeg compress");
            imageToCompress.errorReport = error;
            reject(imageToCompress);
        })
    });
}

const imagemagick = 'magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}';

function imageMagickCompress(imageToCompress, inputFileName, outputFileName) {
    return new Promise((resolve, reject)=>{
        execParas(imagemagick, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                console.log("compressed " + imageToCompress);
                imageToCompress.imagemagick = {inputFile: inputFileName, outputFile: outputFileName};
                resolve(imageToCompress);
            }).catch((error)=> {
                console.log("error during imagemagick compress");
                imageToCompress.errorReport = error;
                reject(imageToCompress);
        })
    });
}

const moveFromQToQ = async (imageToMove, fromQ, toQ)=>{
    try {
        toQ.push(imageToMove);
        fromQ.splice(fromQ.indexOf(imageToMove), 1);
    }catch(error){
        console.log("failure to move " + error);
        throw imageToMove;
    }
};

const compressImagesQInterval = setInterval(()=>{

    if(imagesToCompress.length>0){
        imageToCompress = imagesToCompress.shift();
        console.log("about to compress");
        console.log(imageToCompress);
        compressingImages.pop(imageToCompress);

        writtenImagePath = Path.parse(imageToCompress.fullFilePath);
        pathPrefix = "./";

        // possibly use Path.relative() with "./" or preocess.cwd()
        inputFileName = pathPrefix + imageToCompress.fullFilePath;
        outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
        compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.fileName;

        createDir(pathPrefix + writtenImagePath.dir);

        if(AnimatedGifDetector(FS.readFileSync(imageToCompress.fullFilePath))){
            execParas(ffmpeg, {inputFileName: inputFileName, outputFileName: outputFileName})
            .then((result)=>{
                imageMagickCompress(imageToCompress, outputFileName, compressedFileName).
                then(moveFromQToQ(imageToCompress, compressingImages, compressedImages)).
                catch(moveFromQToQ(imageToCompress, compressingImages, errorProcessingImages));
                // execParas(imagemagick, {inputFileName: outputFileName, outputFileName: compressedFileName}).then((result)=>{
                //     console.log("compressed " +imageToCompress);
                //     compressedImages.push(imageToCompress);
                //     compressingImages.splice(compressingImages.indexOf(imageToCompress),1);
                // }).catch((error)=>{
                //     console.log("error here");
                //     imageToCompress.errorReport = error;
                //     errorProcessingImages.push(imageToCompress);
                //     compressingImages.splice(compressingImages.indexOf(imageToCompress),1);
                // })
            })
            .catch((error)=>{
                console.log("Error During Processing");
                imageToCompress.errorReport = error;
                errorProcessingImages.push(imageToCompress);
                compressingImages.splice(compressingImages.indexOf(imageToCompress),1);
            });
        }else{
            // just apply image magic
            imageMagickCompress(imageToCompress, inputFileName, compressedFileName).
            then(moveFromQToQ(imageToCompress, compressingImages, compressedImages)).
            catch(moveFromQToQ(imageToCompress, compressingImages, errorProcessingImages));

            // execParas(imagemagick, {inputFileName: inputFileName, outputFileName: compressedFileName}).then((result)=>{
            //     console.log("compressed " +imageToCompress);
            //     compressedImages.push(imageToCompress);
            //     compressingImages.splice(compressingImages.indexOf(imageToCompress),1);
            // }).catch((error)=>{
            //     console.log("error here");
            //     imageToCompress.errorReport = error;
            //     errorProcessingImages.push(imageToCompress);
            //     compressingImages.splice(compressingImages.indexOf(imageToCompress),1);
            // })
        }
    }
},500);




