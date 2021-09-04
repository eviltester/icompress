const Shell = require("./commandLineExec.js");
const FS = require('fs');
const Path = require('path');

// This just wraps imageMagick

// add config to experiment with the different attributes for compression e.g. fps values, scale and resize
// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality

// todo: allow config for the different compression options e.g. colours, colour depth, dither, etc.

// todo options to add:
// recommendations for compressing jpg https://stackoverflow.com/questions/7261855/recommendation-for-compressing-jpg-files-with-imagemagick
// -strip to remove comments and meta data
// -quality xx%
// -gaussian-blur 0.05
// -interlace Plane (progressive compression)
// todo: recommendations from Google Page Insights
// https://developers.google.com/speed/docs/insights/OptimizeImages#optimizations-for-gif,-png,-and-jpeg-images
// convert gif to png
// convert INPUT.gif_or_png -strip [-resize WxH] [-alpha Remove] OUTPUT.png
// convert INPUT.jpg -sampling-factor 4:2:0 -strip [-resize WxH] [-quality N] [-interlace JPEG] [-colorspace Gray/sRGB] OUTPUT.jpg

const commands = [
    {name: "colourDepth", template: 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 ${outputFileName}', outputAppend : ""},
    {name: "quality", template: 'magick convert ${inputFileName} -strip -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality", template: 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "jpgSampler", template: 'magick convert ${inputFileName} -sampling-factor 4:2:0 -strip -quality 85% -interlace JPEG ${outputFileName}', outputAppend : "jpg"},
    {name: "jpgProgressive", template: 'magick convert ${inputFileName} -strip -quality 85% -interlace Plane ${outputFileName}', outputAppend : "jpg"},
    {name: "colourDepthPNG", template: 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 ${outputFileName}', outputAppend : ""},
    {name: "qualityPNG", template: 'magick convert ${inputFileName} -strip -quality 85% ${outputFileName}', outputAppend : "png"},

];

function imageMagickCompress(inputFileName, outputFileName, forceCompress){

    // todo: allow configuration and profiles for image magick
    const imagemagick = 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    return Shell.execIfForceOrNew(forceCompress, outputFileName, "imageMagick", imagemagick, commandDetails);
}

function applicableCommands(forFileName){
    const parsedPath = Path.parse(forFileName);
    const validCommands = [];
    for(command of commands){
        let applicable = true;
        if(command.outputAppend==="jpg" && parsedPath.ext===".png"){
            // converting from png to jpg never goes well
            applicable = false;
        }

        if(applicable){
            validCommands.push(command);
        }
    }
    return validCommands;
}

function imageMagickCompressCommand(command, inputFileName, outputFileName, forceCompress){

    const parsedPath = Path.parse(outputFileName);
    let ext = parsedPath.ext;

    if(command.outputAppend){
        if(!outputFileName.endsWith(command.outputAppend)){
            ext = "." + command.outputAppend;
        }
    }

    outputFileName = parsedPath.dir + Path.sep + command.name + "_" + parsedPath.name + ext;

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    return Shell.execIfForceOrNew(forceCompress, outputFileName, command.name, command.template, commandDetails);
}

module.exports={
    commands: commands,
    compressUsingCommand: imageMagickCompressCommand,
    compress: imageMagickCompress,
    applicableCommands : applicableCommands
}