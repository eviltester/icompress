const Shell = require("./commandLineExec.js");
const FS = require('fs');
const Path = require('path');


const Events = require("./Events.js");
const events = new Events.Register();

events.registerListener("console.log", (eventDetails)=>{console.log(eventDetails)});
events.includeInRegisterChain(Shell.events);

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
// https://developers.google.com/speed/docs/insights/OptimizeImages#optimizations-for-gif,-png,-and-jpeg-images
// convert gif to png
// convert INPUT.gif_or_png -strip [-resize WxH] [-alpha Remove] OUTPUT.png
// convert INPUT.jpg -sampling-factor 4:2:0 -strip [-resize WxH] [-quality N] [-interlace JPEG] [-colorspace Gray/sRGB] OUTPUT.jpg

// todo: we could generate different combinations and generate different Names based on the variables e.g. colour${colors}Depth${depth}Quality${quality}
const commands = [
    {name: "quality", template: 'magick convert ${inputFileName} -strip -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality32x08", template: 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality64x08", template: 'magick convert ${inputFileName} -strip +dither -colors 64 -depth 8 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality128x08", template: 'magick convert ${inputFileName} -strip +dither -colors 128 -depth 8 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality256x08", template: 'magick convert ${inputFileName} -strip +dither -colors 256 -depth 8 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality256x08na", template: 'magick convert ${inputFileName} -strip +dither -colors 256 -depth 8 -alpha Remove -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality1024x12", template: 'magick convert ${inputFileName} -strip +dither -colors 1024 -depth 12 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality2048x12", template: 'magick convert ${inputFileName} -strip +dither -colors 2048 -depth 12 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality2048x12na", template: 'magick convert ${inputFileName} -strip +dither -colors 2048 -depth 12 -quality 85% -alpha Remove ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality4096x12", template: 'magick convert ${inputFileName} -strip +dither -colors 4096 -depth 12 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality32768x16", template: 'magick convert ${inputFileName} -strip +dither -colors 32768 -depth 16 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "colourDepthQuality256x16", template: 'magick convert ${inputFileName} -strip +dither -colors 256 -depth 16 -quality 85% ${outputFileName}', outputAppend : ""},
    {name: "jpgSampler", template: 'magick convert ${inputFileName} -sampling-factor 4:2:0 -strip -quality 85% -interlace JPEG ${outputFileName}', outputAppend : "jpg"},
    {name: "jpgProgressive", template: 'magick convert ${inputFileName} -strip -quality 85% -interlace Plane ${outputFileName}', outputAppend : "jpg"},
    {name: "colourDepthPNG", template: 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 ${outputFileName}', outputAppend : ""},
    {name: "qualityPNG", template: 'magick convert ${inputFileName} -strip -quality 85% ${outputFileName}', outputAppend : "png"},

];

// todo investigate sharp for image processing https://sharp.pixelplumbing.com/

// todo: allow configuration and profiles for image magick

function imageMagickCompress(inputFileName, outputFileName, forceCompress){

    const imagemagick = 'magick convert ${inputFileName} -strip +dither -colors 32 -depth 8 ${outputFileName}';

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};
    
    return imageMagickCompressCommand(commands[0], inputFileName, outputFileName, forceCompress);
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

    outputFileName = Path.join(parsedPath.dir, command.name + "_" + parsedPath.name + ext);

    const commandDetails = {inputFileName: inputFileName, outputFileName: outputFileName};

    const stats = FS.statSync(inputFileName);
    const originalFileSizeInBytes = stats.size;
    
    return new Promise((resolve, reject)=> {
        // wrap in a promise and delete if output length is greater than input
        // this is particularly important when we generate combinations of commands
        Shell.execIfForceOrNew(forceCompress, outputFileName, command.name, command.template, commandDetails).
        then((details)=>{
                events.alertListeners(Events.newLogEvent("file size test on " + outputFileName));
                //delete if output length is greater than input
                details.commandDetails.status="COMPRESSED";
                // todo: add a compression amount and %age
                if(details.commandDetails.outputFileSize >= originalFileSizeInBytes){
                    FS.unlink(outputFileName,
                        (err)=> {
                            if (err) {
                                events.alertListeners(Events.newLogEvent("Error deleting " + outputFileName));
                                throw(err);
                            }
                            details.commandDetails.status = "DELETED";
                            events.alertListeners(Events.newLogEvent("DELETED: " + details.commandDetails.outputFileSize +
                                            " >= " + originalFileSizeInBytes + " - " + outputFileName));
                        });
                }
                resolve(details);
            }
        ).catch((error)=>{
            reject(error);
        })
    });
}

module.exports={
    commands: commands,
    compressUsingCommand: imageMagickCompressCommand,
    compress: imageMagickCompress,
    applicableCommands : applicableCommands,
    events: events
}