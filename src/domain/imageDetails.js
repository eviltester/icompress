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

    // making fields private made serialisation and message passing harder

    // #state;  // current state of the image processing
    // #states;  // states image has passed through
    // #src;   // where was this image found url or file path
    // #errorReport;   // a list of error reports for the error over time
    // #commands;    // the commands and results that have been run on the image
    // #fullFilePath;   // the downloaded file for the original image
    // #fileDirPath;    // where any output for the file will be stored
    // #contentLength; // the length reported by headers ... todo: replaced by actual file length once downloaded
    // #contentType; // the type of image
    // #foundOnPage; // the url for the page the image was found on (todo: this might need to be an array to avoid duplication)
    // #rootFolder; // the main parent output folder
    // #fileName;   // the filename without any paths for the original image (todo: could be derived from src)


    constructor(){
        this.state = ImageStates.INITIALISED;
        this.states = [ImageStates.INITIALISED];
        this.src = "";
        this.errorReport = "";
        this.commands= [];

    }

    setState(newState){
        this.state = newState;
        this.states.push(newState);
    }

    getState(){
        return this.state;
    }

    addErrorReport = (error)=> {
        //console.log(error)
        this.errorReport = error;
    };

    setSrc(aUrl) {
        this.src = aUrl;
    }

    getSrc() {
        return this.src;
    }

    setFullFilePath(inputName) {
        this.fullFilePath = inputName;
    }

    getFullFilePath() {
        return this.fullFilePath;
    }

    setContentLength(contentLength) {
        this.contentLength = contentLength;
    }

    getContentLength() {
        return this.contentLength;
    }

    setContentType(contentType) {
        this.contentType = contentType;
    }

    setFoundOnPageUrl(pageUrl){
        this.foundOnPage = pageUrl;
    }

    getFoundOnPage(){
        return this.foundOnPage;
    }

    setRootFolder(aRootFolder) {
        this.rootFolder = aRootFolder;
    }

    getRootFolder(aRootFolder) {
        return this.rootFolder;
    }

    setOriginalFileName(fileNameFromUrl){
        this.fileName = fileNameFromUrl;
    }

    getOriginalFileName(){
        return this.fileName;
    }

    setFileDirPath(aFileDirPath){
        this.fileDirPath = aFileDirPath;
    }

    getFileDirPath(aFileDirPath){
        return this.fileDirPath;
    }

    addCommand(cli, commandDetails){
        this.commands.push({command: cli, details: commandDetails});
    }
}

module.exports = {
    Image : ImageDetails,
    States : ImageStates
}