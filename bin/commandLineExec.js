const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

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
        execSync(command);
        return true;
    }catch(err){
        return false;
    }
}

function execParas(commandLineTemplate, params) {

    // params is an object where each field is a param
    const paramNames = Object.getOwnPropertyNames(params);
    let commandLine = commandLineTemplate;

    for(const paramName of paramNames){
        commandLine = commandLine.split("${"+paramName+"}").join(params[paramName]);// parse the string and replace the template variables
    }

    console.log(commandLine);

    return new Promise((resolve, reject) => {

            execPromise(commandLine).
            then((result)=>{console.log('stdout:', result);
                resolve(result)})
                .catch((error)=>{
                    console.error('stderr:', error);
                    reject(error)
                });
        }
    );
}

module.exports = {
    execPromise,
    execParas,
    commandExists
}