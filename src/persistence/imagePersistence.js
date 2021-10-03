// https://nodejs.org/api/fs.html
const FS = require('fs');

// https://nodejs.org/api/url.html
const Url = require('url').URL;
const Path = require('path');

const ImageDetails = require("../domain/imageDetails");

/*
    Directory/File Management

 */


function createDirForUrlHostname(aUrl){
    return new Promise((resolve, reject) =>{
        const givenUrl = new Url(aUrl);
        createDir(givenUrl.hostname).
        then(success => resolve(givenUrl.hostname)).
        catch(err => reject(err));
    });
}

function createDir(dir){
    return new Promise((resolve, reject)=>{
//        console.log("creating: "  + dir);
        FS.stat(dir,(err,stats)=>{
            if(err){
                reject(err);
            }

            if(stats.isFile()){
                reject("File exists where you want to create directory");
            }

            if(!stats.isDirectory()){
                FS.mkdir(dir, { recursive: true }, (err)=>{
                    if(err){
                        reject(err);
                    }

                    resolve("created: "  + dir);
                })
            }
            if(stats.isDirectory()){
                resolve("directory exists: " + dir);
            }
        })
    })
}

function combineIntoPath(...pathParts) {
    let combinedPath ="";
    let sep = "";
    for (let i=0; i<pathParts.length; i++) {
        var partToAdd = pathParts[i];
        if (partToAdd.trim().length > 0) {
            // remove any trailing slash
            if (partToAdd.endsWith("/") || partToAdd.endsWith("\\")) {
                partToAdd = partToAdd.substring(0, partToAdd.length - 1);
            }
            // remove any starting slash
            if (partToAdd.startsWith("/") || partToAdd.startsWith("\\")) {
                partToAdd = partToAdd.substring(1);
            }
            combinedPath = combinedPath + sep + partToAdd;
            sep = Path.sep;

        }
    }
    return combinedPath;
}

function createFolderStructureForImage(image, root) {
    return new Promise((resolve, reject) => {
        try {
            image.setState(ImageDetails.States.CREATING_FOLDERS);
            image.setRootFolder(root);

            //const urlToParse = img.src;
            const urlToParse = image.getFoundOnPage();

            // create a page folder
            const pathParts = new Url(urlToParse).pathname.split('/').filter(item => item !="");
            let dir = pathParts.join('_');
            // if it is root then make the path _root
            if(dir.length==0){
                dir="_root"
            }

            // create an image name folder
            const fileNamePathParts = new Url(image.getSrc()).pathname.split('/');
            const fileName = fileNamePathParts[fileNamePathParts.length - 1];
            image.setOriginalFileName(fileName);

            //console.log("creating dir " + dir);

            const fileDirPath = combineIntoPath(
                                    image.getRootFolder(),
                                    dir,
                                    image.getOriginalFileName());

            image.setFileDirPath(fileDirPath);
            createDir(fileDirPath).then(msg => {
                image.setState(ImageDetails.States.FILE_SYSTEM_IS_READY);
                resolve(image);
            }).catch(err =>{
                image.setState(ImageDetails.States.ERROR_CREATING_FOLDERS);
                image.addErrorReport(error);
                reject(image);
            })

        }catch(error){
            image.setState(ImageDetails.States.ERROR_CREATING_FOLDERS);
            image.addErrorReport(error);
            reject(image);
        }
    });
}

function outputImageJsonFile(image) {
    //https://nodejs.dev/learn/writing-files-with-nodejs
    try {
        const data = FS.writeFileSync(image.getFullFilePath() + ".json", JSON.stringify(image, null, 2));
        //file written successfully
    } catch (err) {
        console.error(err)
    }
}

function outputImageJsonFiles(imagesToOutput) {

    for(const image of imagesToOutput){
        outputImageJsonFile(image);
    }
}

module.exports ={
    createDir,
    createFolderStructureForImage,
    outputImageJsonFile,
    outputImageJsonFiles,
    combineIntoPath,
    createDirForUrlHostname
}