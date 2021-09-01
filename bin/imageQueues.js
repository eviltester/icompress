// todo: we may not need queues, we may be able to rely on the state field in the image object put this behind an abstraction and test
// e.g. it could be queues.findFirstImageWithState(state) which knows which queue to look in for states,
// then when that works we could remove queues and have a central store and see if it makes a difference,
// if it didn't then queues would be renamed to images

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



module.exports = {
    QueueNames
}
