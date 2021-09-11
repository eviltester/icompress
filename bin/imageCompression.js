//ImageCompressWrapper

//https://nodejs.org/api/path.html
const Path = require('path');

// https://nodejs.org/api/fs.html
const FS = require('fs');

// https://www.npmjs.com/package/animated-gif-detector
const AnimatedGifDetector = require('animated-gif-detector');

const ImageDetails = require("./imageDetails.js");
const ImageStates = ImageDetails.States;
const FFMPEG = require("./ffmpegWrapper.js");
const ImageMagick = require("./imageMagickWrapper.js");

// todo: in the future allow custom commands to be added for images

const Events = require("./Events.js");
const events = new Events.Register();
events.registerListener("console.log", (eventDetails)=>{console.log(eventDetails)});
events.includeInRegisterChain(ImageMagick.events);

function ffmpegCompress(imageToFFmpeg, inputFileName, outputFileName, forceCompress) {

    imageToFFmpeg.setState(ImageStates.COMPRESSING_VIA_FFMPEG);

    return new Promise((resolve, reject)=>{
        FFMPEG.compress(inputFileName, outputFileName, forceCompress)
            .then((result)=>{
                imageToFFmpeg.setState(ImageStates.COMPRESSED_VIA_FFMPEG);
                imageToFFmpeg.addCommand(result.command, result.commandDetails);
                resolve(imageToFFmpeg)
            }).catch((error)=> {
            imageToFFmpeg.setState(ImageStates.ERROR_FFMPEG_COMPRESS);
            imageToFFmpeg.addErrorReport(error);
            reject(imageToFFmpeg);
        })
    });
}

function imageMagickCompress(imageToCompress, inputFileName, outputFileName, forceCompress) {

    imageToCompress.setState(ImageStates.COMPRESSING_VIA_IMAGEMAGICK);

    promises = [];
    for(command of ImageMagick.applicableCommands(inputFileName)){
        promises.push(
            new Promise((resolve, reject)=>{
                ImageMagick.compressUsingCommand(command, inputFileName, outputFileName, forceCompress)
                    .then((result)=>{
                        imageToCompress.setState(ImageStates.COMPRESSED_VIA_IMAGEMAGICK);
                        imageToCompress.addCommand(result.command, result.commandDetails);
                        resolve(imageToCompress);
                    }).catch((error)=> {
                        imageToCompress.setState(ImageStates.ERROR_IMAGEMAGICK_COMPRESS);
                        imageToCompress.addErrorReport(error);
                        reject(imageToCompress);
                })
            })
        )
    }
    return new Promise((resolve, reject)=> {
        return Promise.allSettled(promises).then(
            (fulfilled_rejected) => {
                for (statusEntry of fulfilled_rejected) {
                    if (statusEntry.status == "rejected") {
                        reject(statusEntry.value);
                    }
                }
                resolve(fulfilled_rejected[0].value)
            }
        )
    });

}

function compress(imageToCompress, forceCompressFfmpeg, forceCompressImageMagick){
    const writtenImagePath = Path.parse(imageToCompress.getFullFilePath());
    const pathPrefix = ""; // "./";

    // possibly use Path.relative() with "./" or preocess.cwd()
    const inputFileName = pathPrefix + imageToCompress.getFullFilePath();
    const outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
    const compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.getOriginalFileName();

    events.alertListeners("Starting Compress " + inputFileName);

    if(AnimatedGifDetector(FS.readFileSync(imageToCompress.getFullFilePath()))){

        return new Promise((resolve, reject)=> {
            ffmpegCompress(imageToCompress, inputFileName, outputFileName, forceCompressFfmpeg)
                .then((image) => {
                    imageMagickCompress(imageToCompress, outputFileName, compressedFileName, forceCompressImageMagick)
                        .then((image) => {
                            resolve(image);
                        })
                        .catch((image) => {
                            reject(image);
                        });
                })
                .catch((image) => {
                    reject(image);
                });
        });

    }else{
        // just apply image magic
        return new Promise((resolve, reject)=> {
            imageMagickCompress(imageToCompress, inputFileName, compressedFileName, forceCompressImageMagick).then((image) => {
                resolve(image);
            }).catch((image) => {
                reject(image)
            });
        });
    }
}





module.exports={
    ffmpeg: ffmpegCompress,
    imageMagick: imageMagickCompress,
    compress: compress,
    events: events
}