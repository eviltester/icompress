const Shell = require("./commandLineExec.js");
const FS = require('fs');

// This just wraps ffmpeg

// add config to experiment with the different attributes for compression e.g. fps values, scale and resize
// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
function ffmpegCompress(inputFileName, outputFileName, forceCompress){

    // TODO: document this command fully
    const ffmpeg = 'ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    if (typeof forceCompress === 'undefined') { forceCompress = false; }

    // do not compress again if already exists unless forced to compressffmpeg
    if(!forceCompress && FS.existsSync(outputFileName)){
        const stats = FS.statSync(outputFileName);
        const fileSizeInBytes = stats.size;
        commandDetails.outputFileSize = fileSizeInBytes;
        console.log("FILE EXISTS: skipping ffmpeg compress for " + outputFileName);
        return new Promise(resolve => resolve(
            {ffmpeg: ffmpeg, commandDetails: commandDetails, execResult: ""}));
    }

    return new Promise((resolve, reject)=>{
        Shell.execParas(ffmpeg, commandDetails)
            .then((result)=>{
                const stats = FS.statSync(outputFileName);
                const fileSizeInBytes = stats.size;
                commandDetails.outputFileSize = fileSizeInBytes;
                resolve({ffmpeg: ffmpeg, commandDetails: commandDetails, execResult: result})
            }).catch((error)=> {
            reject(error);
        })
    });
}

module.exports={
    compress: ffmpegCompress
}