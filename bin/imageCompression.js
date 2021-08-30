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


function ffmpegCompress(imageToFFmpeg, inputFileName, outputFileName) {

    imageToFFmpeg.setState(ImageStates.COMPRESSING_VIA_FFMPEG);

    return new Promise((resolve, reject)=>{
        const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};
        FFMPEG.compress(inputFileName, outputFileName)
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

function compress(imageToCompress){
    const writtenImagePath = Path.parse(imageToCompress.getFullFilePath());
    const pathPrefix = "./";

    // possibly use Path.relative() with "./" or preocess.cwd()
    const inputFileName = pathPrefix + imageToCompress.getFullFilePath();
    const outputFileName = pathPrefix + writtenImagePath.dir + Path.sep + "ffmpeged-" + writtenImagePath.base;
    const compressedFileName = pathPrefix +  writtenImagePath.dir + Path.sep + "compressed-" +imageToCompress.getOriginalFileName();

    if(AnimatedGifDetector(FS.readFileSync(imageToCompress.getFullFilePath()))){

        return new Promise((resolve, reject)=> {
            ffmpegCompress(imageToCompress, inputFileName, outputFileName)
                .then((image) => {
                    imageMagickCompress(imageToCompress, outputFileName, compressedFileName)
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
            imageMagickCompress(imageToCompress, inputFileName, compressedFileName).then((image) => {
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
    compress: compress
}