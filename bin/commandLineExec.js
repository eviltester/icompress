const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const FS = require('fs');

const Events = require("./Events.js");
const events = new Events.Register();
events.registerListener("console.log", (eventDetails)=>{console.log(eventDetails)});

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

function commandExists(command){
    try{
        console.log(command)
        execSync(command);
        return true;
    }catch(err){
        return false;
    }
}

function exitIfCliToolNotInstalled(toolName, detectionCommand, installLink){
    if(!commandExists(detectionCommand)){
        events.alertListeners(`Could not detect ${toolName}. Please see ${installLink} for install instructions.`)
        //console.log(`Could not detect ${toolName}. Please see ${installLink} for install instructions.`);
        process.exit(-1);
    }
};

function execParas(commandLineTemplate, params) {

    alertMessage = (message) =>{
        events.alertListeners("execParas");
        events.alertListeners(message)
    }

    // params is an object where each field is a param
    const paramNames = Object.getOwnPropertyNames(params);
    let commandLine = commandLineTemplate;

    for(const paramName of paramNames){
        commandLine = commandLine.split("${"+paramName+"}").join(params[paramName]);// parse the string and replace the template variables
    }

    alertMessage(commandLine);

    return new Promise((resolve, reject) => {

            execPromise(commandLine).
            then((result)=>{
                    alertMessage(result);
                    resolve(result)})
                .catch((error)=>{
                    alertMessage(error);
                    reject(error)
                });
        }
    );
}

function execIfForceOrNew(force, outputFileName,
                          commandName, commandLineTemplate, params){

    if (typeof force === 'undefined') { force = false; }

    alertMessage = (message) =>{
            events.alertListeners("execIfForceOrNew");
            events.alertListeners(message)
        }

    // do not run again if output already exists unless forced to run command
    if(!force && FS.existsSync(outputFileName)){
        const stats = FS.statSync(outputFileName);
        const fileSizeInBytes = stats.size;
        params.outputFileSize = fileSizeInBytes;
        alertMessage("FILE EXISTS: skipping " + commandName + " compress for " + outputFileName);
        return new Promise(resolve => resolve(
            {command: commandLineTemplate, commandDetails: params, execResult: ""}));
    }

    return new Promise((resolve, reject)=>{
        execParas(commandLineTemplate, params)
            .then((result)=>{
                const stats = FS.statSync(outputFileName);
                const fileSizeInBytes = stats.size;
                params.outputFileSize = fileSizeInBytes;
                resolve({command: commandLineTemplate, commandDetails: params, execResult: result})
            }).catch((error)=> {
                reject(error);
            })
    });
}


module.exports = {
    execPromise,
    execParas,
    commandExists,
    exitIfCliToolNotInstalled,
    execIfForceOrNew,
    events
}