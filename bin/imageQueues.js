// todo: we may not need queues, we may be able to rely on the state field in the image object put this behind an abstraction and test
// e.g. it could be queues.findFirstImageWithState(state) which knows which queue to look in for states, then when that works we could remove queues and have a central store and see if it makes a difference, if it didn't then queues would be renamed to images

function ImageQueueNamesEnum(){
    this.IMAGES_TO_PROCESS = "IMAGES_TO_PROCESS";
    this.IMAGES_TO_DOWNLOAD = "IMAGES_TO_DOWNLOAD";
    this.DOWNLOADING_IMAGES = "DOWNLOADING_IMAGES";
    this.IMAGES_TO_COMPRESS = "IMAGES_TO_COMPRESS";
    this.COMPRESSING_IMAGES = "COMPRESSING_IMAGES";
    this.IMAGES_TO_IGNORE = "IMAGES_TO_IGNORE";
    this.COMPRESSED_IMAGES = "COMPRESSED_IMAGES";
    this.ERROR_PROCESSING_IMAGES = "ERROR_PROCESSING_IMAGES";
}

const QueueNames = new ImageQueueNamesEnum();

module.exports = class ImageQueues{

    // todo: make the queue arrays private to encapsulate them within this class and allow changing the implementation in the future
    constructor(){
        this.imagesToProcess = []; // found images
        this.imagesToDownload = []; // images which are big enough to process and download them
        this.downloadingImages = []; // images we are currently downloading
        this.imagesToCompress = []; // images which we need to compress
        this.compressingImages = [];
        this.imagesToLeaveAlone = []; // images which we need to compress
        this.compressedImages = [];
        this.errorProcessingImages = [];

        this.QNames = QueueNames;
        this.Qs = {};
        this.Qs[this.QNames.IMAGES_TO_PROCESS] = this.imagesToProcess;
        this.Qs[this.QNames.IMAGES_TO_DOWNLOAD] = this.imagesToDownload;
        this.Qs[this.QNames.DOWNLOADING_IMAGES] = this.downloadingImages;
        this.Qs[this.QNames.IMAGES_TO_COMPRESS] = this.imagesToCompress;
        this.Qs[this.QNames.COMPRESSING_IMAGES] = this.compressingImages;
        this.Qs[this.QNames.IMAGES_TO_IGNORE] = this.imagesToLeaveAlone;
        this.Qs[this.QNames.COMPRESSED_IMAGES] = this.compressedImages;
        this.Qs[this.QNames.ERROR_PROCESSING_IMAGES] = this.errorProcessingImages;
    }



    // use QName rather than an actual Q
    findFirstImageWithState(desiredState, queueName){

        const qToUse = this.Qs[queueName];

        for(const image of qToUse){
            if(image.state==desiredState){
                return image;
            }
        }
        return null;
    }

    // use QName rather than an actual Q
    moveFromQToQ(imageToMove, fromQName, toQName){
        let fromQ = this.Qs[fromQName];
        let toQ = this.Qs[toQName];

        // // backwards compatibility hack while we convert the code to use names
        if(fromQ==null){
            fromQ=fromQName;
        }

        if(toQ==null){
            toQ=toQName;
        }

        toQ.push(imageToMove);
        fromQ.splice(fromQ.indexOf(imageToMove), 1);
    }

    reportOnQueueLengths(){
        const lines = [];
        lines.push(`To Process: ${imagesToProcess.length}`);
        lines.push(`To Download: ${imagesToDownload.length}`);
        lines.push(`Downloading: ${downloadingImages.length}`);
        lines.push(`To Compress: ${imagesToCompress.length}`);
        lines.push(`Compressing: ${compressingImages.length}`);
        lines.push(`Done: ${compressedImages.length}`);
        lines.push(`Ignored: ${imagesToLeaveAlone.length}`);
        lines.push(`Errors: ${errorProcessingImages.length}`);

        return lines.join("\n");
    }

    allProcessIngQueuesAreEmpty(){
        return(
            imagesToProcess.length===0 &&
            imagesToCompress.length===0 &&
            imagesToDownload.length===0 &&
            downloadingImages.length===0 &&
            compressingImages.length===0);
    }

    reportOnQueueContents(queueName){
        const queue = this.Qs[queueName];

        return JSON.stringify(queue, null, 2);
    }

    reportOnAllQueueContents(){

        const reportLines = [];

        for(const qName in this.QNames){
            if (this.QNames.hasOwnProperty(qName)) {
                reportLines.push(qName)
                reportLines.push("----------------");
                reportLines.push(this.reportOnQueueContents(this.QNames[qName]));
            }
        }

        return reportLines.join("\n");
    }

}
