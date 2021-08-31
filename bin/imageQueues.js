// todo: we may not need queues, we may be able to rely on the state field in the image object put this behind an abstraction and test
// e.g. it could be queues.findFirstImageWithState(state) which knows which queue to look in for states,
// then when that works we could remove queues and have a central store and see if it makes a difference,
// if it didn't then queues would be renamed to images

function ImageQueueNamesEnum(){
    this.IMAGES_TO_PROCESS = "IMAGES_TO_PROCESS";   // found images
    this.IMAGES_TO_DOWNLOAD = "IMAGES_TO_DOWNLOAD"; // images which are big enough to process and download them
    this.DOWNLOADING_IMAGES = "DOWNLOADING_IMAGES"; // images we are currently downloading
    this.IMAGES_TO_COMPRESS = "IMAGES_TO_COMPRESS"; // images which we need to compress
    this.COMPRESSING_IMAGES = "COMPRESSING_IMAGES";
    this.IMAGES_TO_IGNORE = "IMAGES_TO_IGNORE"; // images which we will not process for some reason
    this.COMPRESSED_IMAGES = "COMPRESSED_IMAGES";
    this.ERROR_PROCESSING_IMAGES = "ERROR_PROCESSING_IMAGES";
}

const QueueNames = new ImageQueueNamesEnum();

module.exports = class ImageQueues{

    #imagesToProcess;
    #imagesToDownload;
    #downloadingImages;
    #imagesToCompress;
    #compressingImages;
    #imagesToLeaveAlone;
    #compressedImages;
    #errorProcessingImages;

    constructor(){
        this.#imagesToProcess = []; // found images
        this.#imagesToDownload = []; // images which are big enough to process and download them
        this.#downloadingImages = []; // images we are currently downloading
        this.#imagesToCompress = []; // images which we need to compress
        this.#compressingImages = [];
        this.#imagesToLeaveAlone = []; // images which we need to compress
        this.#compressedImages = [];
        this.#errorProcessingImages = [];

        this.QNames = QueueNames;
        this.Qs = {};
        this.Qs[this.QNames.IMAGES_TO_PROCESS] = this.#imagesToProcess;
        this.Qs[this.QNames.IMAGES_TO_DOWNLOAD] = this.#imagesToDownload;
        this.Qs[this.QNames.DOWNLOADING_IMAGES] = this.#downloadingImages;
        this.Qs[this.QNames.IMAGES_TO_COMPRESS] = this.#imagesToCompress;
        this.Qs[this.QNames.COMPRESSING_IMAGES] = this.#compressingImages;
        this.Qs[this.QNames.IMAGES_TO_IGNORE] = this.#imagesToLeaveAlone;
        this.Qs[this.QNames.COMPRESSED_IMAGES] = this.#compressedImages;
        this.Qs[this.QNames.ERROR_PROCESSING_IMAGES] = this.#errorProcessingImages;
    }


    findFirstInQWhere(queueName, matchingFunc){

        const qToUse = this.Qs[queueName];

        return qToUse.find(matchingFunc);
    }

    // use QName rather than an actual Q
    moveFromQToQ(thingToMove, fromQName, toQName){
        let fromQ = this.Qs[fromQName];
        let toQ = this.Qs[toQName];

        // // backwards compatibility hack while we convert the code to use names
        if(fromQ==null){
            fromQ=fromQName;
        }

        if(toQ==null){
            toQ=toQName;
        }

        toQ.push(thingToMove);
        fromQ.splice(fromQ.indexOf(thingToMove), 1);
    }

    reportOnQueueLengths(){
        const lines = [];
        for(const qName in this.Qs){
            lines.push(`${qName}: ${this.Qs[qName].length}`);
        }

        return lines.join("\n");
    }

    allGivenQueuesAreEmpty(qNames){
        for(const qName of qNames){
            if(this.Qs[qName].length!=0){
                return false;
            }
        }
        return true;
    }

    reportOnQueueContents(queueName){
        const queue = this.Qs[queueName];

        return JSON.stringify(queue, null, 2);
    }

    reportOnAllQueueContents(){

        const reportLines = [];

        for(const qName of Object.getOwnPropertyNames(this.QNames)){
                reportLines.push(qName)
                reportLines.push("----------------");
                reportLines.push(this.reportOnQueueContents(this.QNames[qName]));
        }

        return reportLines.join("\n");
    }

    getItemsFromQueue(qName) {
        const queue = this.Qs[qName];
        return queue.map( (image) => image);
    }

    addToQueue(item, qName) {
        this.Qs[qName].push(item);
    }
}
