const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const FS = require('fs');

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
        console.log(`Could not detect ${toolName}. Please see ${installLink} for install instructions.`);
        process.exit(-1);
    }
};

function execParas(commandLineTemplate, params, progressCallBack) {

    if(!progressCallBack){
        progressCallBack = (message) =>{console.log("execIfForceOrNew");console.log(message)}
    }

    // params is an object where each field is a param
    const paramNames = Object.getOwnPropertyNames(params);
    let commandLine = commandLineTemplate;

    for(const paramName of paramNames){
        commandLine = commandLine.split("${"+paramName+"}").join(params[paramName]);// parse the string and replace the template variables
    }

    progressCallBack(commandLine);

    return new Promise((resolve, reject) => {

            execPromise(commandLine).
            then((result)=>{progressCallBack('stdout:', result);
                resolve(result)})
                .catch((error)=>{
                    progressCallBack('stderr:', error);
                    reject(error)
                });
        }
    );
}

function execIfForceOrNew(force, outputFileName,
                          commandName, commandLineTemplate, params, progressCallBack){

    if (typeof force === 'undefined') { force = false; }

    if(!progressCallBack){
        progressCallBack = (message) =>{console.log("execIfForceOrNew");console.log(message)}
    }

    // do not run again if output already exists unless forced to run command
    if(!force && FS.existsSync(outputFileName)){
        const stats = FS.statSync(outputFileName);
        const fileSizeInBytes = stats.size;
        params.outputFileSize = fileSizeInBytes;
        progressCallBack("FILE EXISTS: skipping " + commandName + " compress for " + outputFileName);
        return new Promise(resolve => resolve(
            {command: commandLineTemplate, commandDetails: params, execResult: ""}));
    }

    return new Promise((resolve, reject)=>{
        execParas(commandLineTemplate, params, progressCallBack)
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
    execIfForceOrNew
}