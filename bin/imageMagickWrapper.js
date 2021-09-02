const Shell = require("./commandLineExec.js");
const FS = require('fs');

// This just wraps imageMagick

// add config to experiment with the different attributes for compression e.g. fps values, scale and resize
// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality

// todo: allow config for the different compression options e.g. colours, colour depth, dither, etc.
function imageMagickCompress(inputFileName, outputFileName, forceCompress){

    // todo: allow configuration and profiles for image magick
    const imagemagick = 'magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    if (typeof forceCompress === 'undefined') { forceCompress = false; }

    // do not compress again if already exists unless forced to compressffmpeg
    if(!forceCompress && FS.existsSync(outputFileName)){
        const stats = FS.statSync(outputFileName);
        const fileSizeInBytes = stats.size;
        commandDetails.outputFileSize = fileSizeInBytes;
        console.log("FILE EXISTS: skipping imagemagick compress for " + outputFileName);
        return new Promise(resolve => resolve(
            {imagemagick: imagemagick, commandDetails: commandDetails, execResult: ""}));
    }

    return new Promise((resolve, reject)=>{
        Shell.execParas(imagemagick, commandDetails)
            .then((result)=>{
                const stats = FS.statSync(outputFileName);
                const fileSizeInBytes = stats.size;
                commandDetails.outputFileSize = fileSizeInBytes;
                resolve({imagemagick: imagemagick, commandDetails: commandDetails, execResult: result})
            }).catch((error)=> {
            reject(error);
        })
    });
}

module.exports={
    compress: imageMagickCompress
}