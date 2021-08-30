const Shell = require("./commandLineExec.js");

// This just wraps imageMagick

// add config to experiment with the different attributes for compression e.g. fps values, scale and resize
// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
function imageMagickCompress(inputFileName, outputFileName){

    // todo: allow configuration and profiles for image magick
    const imagemagick = 'magick convert ${inputFileName} +dither -colors 32 -depth 8 ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    return new Promise((resolve, reject)=>{
        Shell.execParas(imagemagick, commandDetails)
            .then((result)=>{
                resolve({imagemagick: imagemagick, commandDetails: commandDetails, execResult: result})
            }).catch((error)=> {
            reject(error);
        })
    });
}

module.exports={
    compress: imageMagickCompress
}