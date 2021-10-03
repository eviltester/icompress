// https://github.com/matthew-andrews/isomorphic-fetch
const fetch = require('isomorphic-fetch');

//https://github.com/jsdom/jsdom
const { JSDOM } = require("jsdom");

// https://nodejs.org/api/fs.html
const FS = require('fs');

// https://www.npmjs.com/package/jsdom
// https://medium.com/@bretcameron/how-to-build-a-web-scraper-using-javascript-11d7cd9f77f2

const IpcLogging = require('../app/ipcLoggerClient');

const ipcLogger = new IpcLogging.IpcLoggerClient("httpWrapper")
ipcLogger.connect();

function logMessage(message){
    console.log(message);
    ipcLogger.logMessage(message);
}

// a downloadFile method which... given a url and an output path downloads the file and writes it to disk
function downloadFile(fromUrl, toFilePath, forceDownload) {

    if (typeof forceDownload === 'undefined') { forceDownload = false; }

    if(forceDownload){
        return promiseToDownloadFile(fromUrl, toFilePath);
    }

    // do not download again if already exists
    // if(FS.existsSync(toFilePath)){
    //     logMessage("FILE EXISTS: skipping download for " + toFilePath);
    //     return new Promise(resolve => resolve({}));
    // }

    return new Promise((resolve, reject)=>{
        FS.stat(toFilePath, (err,stats)=>{
            if(err){
                logMessage("FILE EXISTS: skipping download for " + toFilePath);
                resolve({});
            }

            if(!stats.isFile()){
                promiseToDownloadFile(fromUrl, toFilePath).
                then(response => resolve(response)).
                catch(error => reject(error));
            }
        })
    })



}

function promiseToDownloadFile(fromUrl, toFilePath){
    return new Promise((resolve, reject) => {
        const fileStream = FS.createWriteStream(toFilePath);
        fetch(fromUrl).
        then((response)=>{
            response.body.pipe(fileStream);
            response.body.on("error", reject);
            fileStream.on("finish", resolve);
            resolve(response)
        }).
        catch((error)=>{
            console.error('stderr:', error);
            reject(error);
        });
    });
}

function getDomFromUrl(url){

    logMessage("Getting "  + url);

    return new Promise((resolve, reject) => {

        fetch(url).then((response) =>{
            return response.text();
        }).then((text)=>{
            resolve(new JSDOM(text))
        }).catch((error)=>{
            logMessage("could not get " + url);
            logMessage(error);
            reject(error);
        })
    });
}

function getHeaders(url) {
    return new Promise((resolve, reject) => {
        fetch(url, {method: 'HEAD'}).
        then(function(response) {
            //console.log(response.headers);
            resolve(response.headers);
        }).
        catch((error)=>{
            reject(error);
        });
    });
}

module.exports = {
    downloadFile,
    getDomFromUrl,
    getHeaders
}