const HTTP = require("./httpWrapper.js");
const ImageDetails = require("./imageDetails.js");
const Path = require('path');

function getImageHeaders(img) {

    //const img = {src:url};


    return new Promise((resolve, reject) => {
        img.setState(ImageDetails.States.FETCHING_HEADERS);

        HTTP.getHeaders(img.getSrc()).
        then(function(headers) {
            img.setState(ImageDetails.States.FETCHED_HEADERS);
            img.setContentLength(headers.get('content-length'));
            img.setContentType(headers.get('Content-Type'));
            resolve(img);
        }).
        catch((error)=>{
            // todo: consider if setState should also allow a 'message', then the error report could be associated with the state change
            img.setState(ImageDetails.States.ERROR_FETCHING_HEADERS);
            img.addErrorReport(error);
            reject({image: img, error: error});
        });
    });
}

function downloadImageFile(img, forceDownload) {

    img.setState(ImageDetails.States.DOWNLOADING);

    return new Promise((resolve, reject) => {
        const downloadTo = img.getFileDirPath() + Path.sep + img.getOriginalFileName();
        img.setFullFilePath(downloadTo);
        HTTP.downloadFile(img.getSrc(), downloadTo, forceDownload).
        then((response)=>{
            img.setState(ImageDetails.States.DOWNLOADED);
            resolve(img)
        }).
        catch((error)=>{
            img.setState(ImageDetails.States.ERROR_DOWNLOADING);
            reject(error);
        });
    });

}

module.exports= {
    getImageHeaders,
    downloadImageFile
}