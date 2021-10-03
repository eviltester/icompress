// todo: we may not need queues, we may be able to rely on the state field in the image object put this behind an abstraction and test
// e.g. it could be queues.findFirstImageWithState(state) which knows which queue to look in for states,
// then when that works we could remove queues and have a central store and see if it makes a difference,
// if it didn't then queues would be renamed to images

const Queues = require("./qManager");
const ImageDetails = require("../domain/imageDetails.js");
const ImageHTTP = require("../http/imageHttp");
const ImageStates = ImageDetails.States;
const CompressImage = require("../compression/imageCompression");
const Persist = require("../persistence/imagePersistence");

function ImageQueueNamesEnum(){
    this.IMAGES_TO_SCAN = "IMAGES_TO_SCAN"; // inmage to get header and see if we should scan
    this.IMAGES_TO_PROCESS = "IMAGES_TO_PROCESS";   // found images, ready to evaluate if should download or not - possibly "DECIDE_DOWNLOAD_OR_NOT:
    this.IMAGES_TO_DOWNLOAD = "IMAGES_TO_DOWNLOAD"; // images which are big enough to process and download them
    this.DOWNLOADING_IMAGES = "DOWNLOADING_IMAGES"; // images we are currently downloading
    this.IMAGES_TO_COMPRESS = "IMAGES_TO_COMPRESS"; // images which we need to compress
    this.COMPRESSING_IMAGES = "COMPRESSING_IMAGES";
    this.IMAGES_TO_IGNORE = "IMAGES_TO_IGNORE"; // images which we will not process for some reason
    this.COMPRESSED_IMAGES = "COMPRESSED_IMAGES";
    this.ERROR_PROCESSING_IMAGES = "ERROR_PROCESSING_IMAGES";
}

const QueueNames = new ImageQueueNamesEnum();

class ImageQueueManager{

    constructor(forceActionsSettings){
        const ImageQNames = Object.getOwnPropertyNames(QueueNames);
        this.imageQueues = new Queues.QManager(ImageQNames);
        this.forceactions = forceActionsSettings;
    }

    queues(){
        return this.imageQueues;
    }

    allProcessingQueuesAreEmpty(){
        return this.imageQueues.allGivenQueuesAreEmpty([
            QueueNames.IMAGES_TO_DOWNLOAD,
            QueueNames.IMAGES_TO_PROCESS,
            QueueNames.IMAGES_TO_COMPRESS,
            QueueNames.DOWNLOADING_IMAGES,
            QueueNames.COMPRESSING_IMAGES
        ]);
    }

    outputImageJsonFiles() {
        Persist.outputImageJsonFiles(this.imageQueues.getItemsFromQueue(QueueNames.COMPRESSED_IMAGES));
    }

    // decided not to add this into the PageQueueManager because it is an Image Processing function, so passed it in as a callback
    createImageFromUrl(anImageUrl, aPageUrl){
        return new Promise((resolve, reject) => {

            const img = new ImageDetails.Image();
            img.setSrc(anImageUrl);
            img.setFoundOnPageUrl(aPageUrl);

            // todo: check if json file has been downloaded if so we don't need to reprocess headers unless forced to

            ImageHTTP.getImageHeaders(img)
                .then((img) => {
                    this.imageQueues.addToQueue(img, QueueNames.IMAGES_TO_PROCESS);
                    resolve(img);
                }).catch((errorDetails) => {
                this.imageQueues.addToQueue(img, QueueNames.ERROR_PROCESSING_IMAGES);
                //console.log("image error");
                //console.log(errorDetails.error)
                reject(errorDetails.image)
            });
        });
    }

    addImageToCompressQueue(img){
        this.imageQueues.addToQueue(img, QueueNames.IMAGES_TO_PROCESS);
    }

    findFirstImageWithState = (state, qName) => {
        return this.imageQueues.findFirstInQWhere(
                                    qName,
                        (image) => {return image.getState()==state})
    }

    filterImagesAndAddToDownloadQueue(maxK){

        const image = this.findFirstImageWithState(ImageStates.FETCHED_HEADERS, QueueNames.IMAGES_TO_PROCESS);
        if(image==null){
            return;
        }

        image.setState(ImageStates.SHOULD_DOWNLOAD_EVALUATION);

        if(image.getContentLength()>=(maxK*1000)){
            image.setState(ImageStates.WILL_DOWNLOAD);
            this.imageQueues.moveFromQToQ(image, QueueNames.IMAGES_TO_PROCESS, QueueNames.IMAGES_TO_DOWNLOAD);
        }else{
            image.setState(ImageStates.IGNORED);
            this.imageQueues.moveFromQToQ(image, QueueNames.IMAGES_TO_PROCESS, QueueNames.IMAGES_TO_IGNORE);
        }
    }

    processCompressImagesQ(forceCompressFFmpeg, forceCompressMagick){

        const imageToCompress = this.findFirstImageWithState(ImageStates.READY_TO_COMPRESS,
                                                            QueueNames.IMAGES_TO_COMPRESS);

        if(imageToCompress==null){
            return;
        }
        imageToCompress.setState(ImageStates.ABOUT_TO_COMPRESS);
        this.imageQueues.moveFromQToQ(imageToCompress, QueueNames.IMAGES_TO_COMPRESS, QueueNames.COMPRESSING_IMAGES);

        CompressImage.compress(imageToCompress, forceCompressFFmpeg, forceCompressMagick).
        then((image)=>{
            this.imageQueues.moveFromQToQ(image, QueueNames.COMPRESSING_IMAGES, QueueNames.COMPRESSED_IMAGES);
            Persist.outputImageJsonFile(image);
        }).catch((image)=>{
            this.imageQueues.moveFromQToQ(image, QueueNames.COMPRESSING_IMAGES, QueueNames.ERROR_PROCESSING_IMAGES)
        });

    };

    processDownloadImagesQ(forceDownload){

        const imageToDownload = this.findFirstImageWithState(
                                                    ImageStates.AWAITING_DOWNLOAD,
                                                    QueueNames.IMAGES_TO_DOWNLOAD);

        if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
            return;
        }

        imageToDownload.setState(ImageStates.ABOUT_TO_DOWNLOAD);
        this.imageQueues.moveFromQToQ(imageToDownload, QueueNames.IMAGES_TO_DOWNLOAD, QueueNames.DOWNLOADING_IMAGES);

        //console.log(this.imageQueues.reportOnQueueContents(QueueNames.IMAGES_TO_DOWNLOAD));
        ImageHTTP.downloadImageFile(imageToDownload, forceDownload).
        then(()=>{
            imageToDownload.setState(ImageStates.READY_TO_COMPRESS);
            this.imageQueues.moveFromQToQ(imageToDownload,
                                            QueueNames.DOWNLOADING_IMAGES,
                                            QueueNames.IMAGES_TO_COMPRESS);
        }).
        catch((error)=> {
            imageToDownload.setState(ImageStates.ERROR_DOWNLOADING);
            imageToDownload.addErrorReport(error);
            this.imageQueues.moveFromQToQ(imageToDownload,
                                            QueueNames.DOWNLOADING_IMAGES,
                                            QueueNames.ERROR_PROCESSING_IMAGES);
        });

    }


    processQueueToCreateFolderStructure(rootFolder){
        const imageToDownload = this.findFirstImageWithState(
                                                ImageStates.WILL_DOWNLOAD,
                                                QueueNames.IMAGES_TO_DOWNLOAD);

        if(imageToDownload==null){ // nothing in the Queue waiting to be downloaded
            return;
        }

        Persist.createFolderStructureForImage(imageToDownload, rootFolder).
        then((image)=>{
            image.setState(ImageStates.AWAITING_DOWNLOAD);
            // no Qs to move
        }).catch((image)=>{
            this.imageQueues.moveFromQToQ(image,
                                            QueueNames.IMAGES_TO_DOWNLOAD,
                                            QueueNames.ERROR_PROCESSING_IMAGES)
        });

    }

    startCreateFolderStructureQProcessing(rootFolder, everyMilliseconds){
        this.createFolderStructureQInterval = setInterval(()=>{
                                this.processQueueToCreateFolderStructure(rootFolder)
                                },everyMilliseconds);
    }

    stopCreateFolderStructureQProcessing(){
        clearInterval(this.createFolderStructureQInterval);
    }



    startCompressImageQProcessing(forceCompressFFmpeg, forceCompressImageMagick, everyMilliseconds){
        this.compressImagesQInterval =
            setInterval(()=>{
                this.processCompressImagesQ(
                    forceCompressFFmpeg,
                    forceCompressImageMagick)}
                ,everyMilliseconds);
    }

    stopCompressImageQProcessing(){
        clearInterval(this.compressImagesQInterval);
    }

    startFilterImagesQProcessing(minimumImageSize, everyMilliseconds){
        this.addImagesToDownloadQInterval =
                    setInterval(()=>{
                        this.filterImagesAndAddToDownloadQueue(minimumImageSize)
                    },everyMilliseconds);
    }

    stopFilterImagesQProcessing(){
        clearInterval(this.addImagesToDownloadQInterval);
    }

    startDownloadImageQProcessing(forceDownload, everyMilliseconds){
        this.downloadImagesQInterval = setInterval(()=>{
            this.processDownloadImagesQ(forceDownload)
        },everyMilliseconds);
    }

    stopDownloadImageQProcessing(){
        clearInterval(this.downloadImagesQInterval);
    }

    stopAllQueues(){
        this.stopCompressImageQProcessing();
        this.stopCreateFolderStructureQProcessing();
        this.stopDownloadImageQProcessing();
        this.stopFilterImagesQProcessing();
    }
}

module.exports = {
    QueueNames,
    ImageQueueManager
}
