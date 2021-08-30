// https://github.com/matthew-andrews/isomorphic-fetch
const fetch = require('isomorphic-fetch');

//https://github.com/jsdom/jsdom
const { JSDOM } = require("jsdom");

// https://nodejs.org/api/fs.html
const FS = require('fs');

// https://www.npmjs.com/package/jsdom
// https://medium.com/@bretcameron/how-to-build-a-web-scraper-using-javascript-11d7cd9f77f2

// a downloadFile method which... given a url and an output path downloads the file and writes it to disk
function downloadFile(fromUrl, toFilePath) {
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

    console.log("Getting "  + url);

    return new Promise((resolve, reject) => {

        fetch(url).then((response) =>{
            return response.text();
        }).then((text)=>{
            resolve(new JSDOM(text))
        }).catch((error)=>{
            console.log("could not get " + url);
            console.log(error);
            reject(error);
        })
    });
}

function getHeaders(url) {
    return new Promise((resolve, reject) => {
        fetch(url, {method: 'HEAD'}).
        then(function(response) {
            console.log(response.headers);
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