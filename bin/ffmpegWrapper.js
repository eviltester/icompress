const Shell = require("./commandLineExec.js");

// This just wraps ffmpeg

// add config to experiment with the different attributes for compression e.g. fps values, scale and resize
// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
function ffmpegCompress(inputFileName, outputFileName){

    // TODO: document this command fully
    const ffmpeg = 'ffmpeg -i ${inputFileName} -lavfi "mpdecimate,fps=3,scale=0:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse" -vsync 0 -y ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    return new Promise((resolve, reject)=>{
        Shell.execParas(ffmpeg, commandDetails)
            .then((result)=>{
                resolve({ffmpeg: ffmpeg, commandDetails: commandDetails, execResult: result})
            }).catch((error)=> {
            reject(error);
        })
    });
}

module.exports={
    compress: ffmpegCompress
}