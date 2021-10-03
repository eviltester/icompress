const PageQueues = require("../queues/pageQueues");
const ImageQueues = require("../queues/imageQueues.js");

class Scanner{

    constructor(rootFolder, forceActions) {
        this.forceActions = forceActions;
        this.rootFolder=rootFolder;
        this.pageQManager = new PageQueues.PageQueueManager();
        this.imageQManager = new ImageQueues.ImageQueueManager(forceActions);
    }

    addPageToScan(aUrl){
        this.pageQManager.queueUpThePageURL(aUrl);
    }


    queuesAreEmpty(){
        return (
            this.imageQManager.allProcessingQueuesAreEmpty()
            &&
            this.pageQManager.allProcessingQueuesAreEmpty()
        );

    }

    startQueueProcessing(){
        // Page Queue Intervals
        const createImageFromUrl = (anImageUrl, aPageUrl)=>{
            this.imageQManager.createImageFromUrl(anImageUrl, aPageUrl);
        }
        this.pageQManager.startPageProcessingQueue(createImageFromUrl, 100);
//const reportOnPageQsInterval = setInterval(()=>{console.log(pageQManager.queues().reportOnQueueLengths())},500);

// Image Queue Intervals
        this.imageQManager.startCreateFolderStructureQProcessing(this.rootFolder, 100);
        this.imageQManager.startFilterImagesQProcessing(50, 500);
        this.imageQManager.startDownloadImageQProcessing(this.forceActions.download,500);
        this.imageQManager.startCompressImageQProcessing(this.forceActions.compressffmpeg, this.forceActions.compressmagick, 1000);
//const reportOnImageQsInterval = setInterval(()=>{console.log(imageQManager.queues().reportOnQueueLengths())},500);

    }

    getPageQManager(){
        return this.pageQManager;
    }

    getImageQManager(){
        return this.imageQManager;
    }
}

module.exports = {
    Scanner
}