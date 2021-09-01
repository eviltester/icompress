
function PageQueueNamesEnum(){
    this.READY_TO_SCAN = "READY_TO_SCAN";
    this.SCANNING = "SCANNING";
    this.SCANNED = "SCANNED";
    this.PAGES_TO_IGNORE = "PAGES_TO_IGNORE";
    this.ERROR_PROCESSING_PAGES = "ERROR_PROCESSING_PAGES";
}

const QueueNames = new PageQueueNamesEnum();



module.exports = {
    QueueNames
}