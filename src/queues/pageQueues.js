const Queues = require("./qManager");
const Persist = require("../persistence/imagePersistence");
const Page = require("../domain/page");

function PageQueueNamesEnum(){
    this.READY_TO_SCAN = "READY_TO_SCAN";
    this.SCANNING = "SCANNING";
    this.SCANNED = "SCANNED";
    this.PAGES_TO_IGNORE = "PAGES_TO_IGNORE";
    this.ERROR_PROCESSING_PAGES = "ERROR_PROCESSING_PAGES";
}

const QueueNames = new PageQueueNamesEnum();


class PageQueueManager{

    constructor(){
        const PageQNames = Object.getOwnPropertyNames(QueueNames);
        this.pageQueues = new Queues.QManager(PageQNames);
    }

    queueUpThePageURL(aUrl){
        const page = new Page.Page(aUrl);

        page.getDom().
        then((page)=>{
            Persist.createDirForUrlHostname(page.getUrl()).
            then(msg =>
                this.pageQueues.addToQueue(page, QueueNames.READY_TO_SCAN)
            ).catch((error) => {throw error});

        }).catch((error)=>{
            this.pageQueues.addToQueue(page, QueueNames.ERROR_PROCESSING_PAGES);
        });
    }

    processPageQueueToScan(imageProcessingCallBack){

        const page = this.pageQueues.findFirstInQWhere(QueueNames.READY_TO_SCAN, (page) => {
            return page.getState() == Page.States.FOUND
        });
        if(page==null){ // nothing in the Queue waiting to be scanned
            return;
        }
        page.setState(Page.States.SCANNING);
        this.pageQueues.moveFromQToQ(page, QueueNames.READY_TO_SCAN, QueueNames.SCANNING);

        const imageScanningPromises = [];

        const imageUrls = page.getAllImageUrlsFromDom();
        for(const imageUrl of imageUrls){
            imageScanningPromises.push(imageProcessingCallBack(imageUrl, page.getUrl()));
        }

        /*
            wait for all imageProcessingCallBack promises to resolve
            before setting state for page and moving to scanned
            this will allow recovery in the future if we
            save out queue states and details to allow stopping the script
         */
        Promise.allSettled(imageScanningPromises).then((values) => {
            page.setState(Page.States.SCANNED);
            this.pageQueues.moveFromQToQ(page, QueueNames.SCANNING, QueueNames.SCANNED);
        });
    }

    allProcessingQueuesAreEmpty(){
        return this.pageQueues.allGivenQueuesAreEmpty([
                    QueueNames.READY_TO_SCAN,
                    QueueNames.SCANNING
                ]);
    }

    queues(){
        return this.pageQueues;
    }

    // storing it in the class will allow us to stopPageProcessingQueue
    startPageProcessingQueue(imageProcessingCallBack, everyMilliseconds) {
        this.pageProcessingQInterval = setInterval(()=>{
                                                this.processPageQueueToScan(imageProcessingCallBack)
                                            }
                                            ,everyMilliseconds
                                        );
    }

    stopPageProcessingQueue(){
        clearInterval(this.pageProcessingQInterval);
    }

    stopAllQueues(){
        this.stopPageProcessingQueue();
    }

}


module.exports = {
    QueueNames,
    PageQueueManager
}