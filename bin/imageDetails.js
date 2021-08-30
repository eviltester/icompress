function ImageStatesEnum(){

    this.INITIALISED = "INITIALISED";
    this.FETCHING_HEADERS = "FETCHING_HEADERS";
    this.FETCHED_HEADERS = "FETCHED_HEADERS";
    this.SHOULD_DOWNLOAD_EVALUATION = "SHOULD_DOWNLOAD_EVALUATION";
    this.WILL_DOWNLOAD = "WILL_DOWNLOAD";
    this.CREATING_FOLDERS = "CREATING_FOLDERS";
    this.FILE_SYSTEM_IS_READY = "FILE_SYSTEM_IS_READY";
    this.AWAITING_DOWNLOAD = "AWAITING_DOWNLOAD";
    this.ABOUT_TO_DOWNLOAD = "ABOUT_TO_DOWNLOAD";
    this.IGNORED = "IGNORED";
    this.DOWNLOADING = "DOWNLOADING";
    this.DOWNLOADED = "DOWNLOADED";
    this.READY_TO_COMPRESS = "READY_TO_COMPRESS";
    this.ABOUT_TO_COMPRESS = "ABOUT_TO_COMPRESS";
    this.COMPRESSING_VIA_FFMPEG = "COMPRESSING_VIA_FFMPEG";
    this.COMPRESSED_VIA_FFMPEG = "COMPRESSED_VIA_FFMPEG";
    this.COMPRESSING_VIA_IMAGEMAGICK = "COMPRESSING_VIA_IMAGEMAGICK";
    this.COMPRESSED_VIA_IMAGEMAGICK = "COMPRESSED_VIA_IMAGEMAGICK";

    this.ERROR_FETCHING_HEADERS = "ERROR_FETCHING_HEADERS";
    this.ERROR_CREATING_FOLDERS = "ERROR_CREATING_FOLDERS";
    this.ERROR_DOWNLOADING = "ERROR_DOWNLOADING";
    this.ERROR_FFMPEG_COMPRESS = "ERROR_FFMPEG_COMPRESS";
    this.ERROR_IMAGEMAGICK_COMPRESS = "ERROR_IMAGEMAGICK_COMPRESS";
}

const ImageStates = new ImageStatesEnum();

class ImageDetails{

    // TODO: investigate the getter/setter shortcut code for JavaScript

    // TODO: add comments to describe each field
    // TODO: should be able to rename these as necessary because they are supposed to be encapsulated here
    #state;
    #states;
    #src;
    #errorReport;
    #commands;
    #fullFilePath;
    #fileDirPath;
    #contentLength;
    #contentType;
    #foundOnPage;
    #rootFolder;
    #fileName;
    #dir;

    /*
    image:
       src // download url from src attribute
       contentLength // header reported by server
       type // type reported by server
       dir  // directory plan to write to
       fileName // planned filename to use
       fullFilePath // actual file path for the file
       foundOnPage  // url of parent page
    */


    constructor(){
        this.#state = ImageStates.INITIALISED;
        this.#states = [ImageStates.INITIALISED];
        this.#src = "";
        this.#errorReport = "";
        this.#commands= [];


        // since the fields are private we need to have a toJSON if we want to use JSON.Stringify
        // remember we need a fromJSON if we want to deserialize in the future
        this.toJSON = function() {
            return {
                state : this.#state,
                states : this.#states,
                src : this.#src,
                foundOnPage : this.#foundOnPage,
                contentLength: this.#contentLength,
                contentType: this.#contentType,
                fullFilePath : this.#fullFilePath,
                fileDirPath : this.#fileDirPath,
                rootFolder : this.#rootFolder,
                fileName : this.#fileName,
                dir : this.#dir,
                commands: this.#commands,
                errorReport: this.#errorReport,
            };
        };

    }

    setState(newState){

        console.log(this.#src);
        console.log(newState);

        this.#state = newState;
        this.#states.push(newState);
    }

    getState(){
        return this.#state;
    }

    addErrorReport = (error)=> {
        console.log(error);
        this.#errorReport = error;
    };

    setSrc(aUrl) {
        this.#src = aUrl;
    }

    getSrc() {
        return this.#src;
    }

    setFullFilePath(inputName) {
        this.#fullFilePath = inputName;
    }

    getFullFilePath() {
        return this.#fullFilePath;
    }

    setContentLength(contentLength) {
        this.#contentLength = contentLength;
    }

    getContentLength() {
        return this.#contentLength;
    }

    setContentType(contentType) {
        this.#contentType = contentType;
    }

    setFoundOnPageUrl(pageUrl){
        this.#foundOnPage = pageUrl;
    }

    getFoundOnPage(){
        return this.#foundOnPage;
    }

    setRootFolder(aRootFolder) {
        this.#rootFolder = aRootFolder;
    }

    getRootFolder(aRootFolder) {
        return this.#rootFolder;
    }

    setOriginalFileName(fileNameFromUrl){
        this.#fileName = fileNameFromUrl;
    }

    getOriginalFileName(){
        return this.#fileName;
    }

    setUrlPath(pathDir) {
        // note that the url path /a/b/c is represented as a_b_c to allow using on disk
        // todo: consider storing the original path to allow calling code to parse as required
        this.#dir = pathDir;
    }

    getUrlPath(){
        return this.#dir;
    }

    setFileDirPath(aFileDirPath){
        this.#fileDirPath = aFileDirPath;
    }

    getFileDirPath(aFileDirPath){
        return this.#fileDirPath;
    }

    addCommand(cli, commandDetails){
        this.#commands.push({command: cli, details: commandDetails});
    }
}

module.exports = {
    Image : ImageDetails,
    States : ImageStates
}