const HTTP = require("../http/httpWrapper");
const Persist = require("../persistence/imagePersistence");
const IpcLogging = require('../app/ipcLoggerClient');

function PageStatesEnum(){
    this.INITIALISED = "INITIALISED";
    this.FOUND = "FOUND";
    this.SCANNING = "SCANNING";
    this.SCANNED = "SCANNED";
    this.IN_ERROR = "IN_ERROR";
}

const States = new PageStatesEnum();

class Page{

    #url;
    #state;
    #states;
    #dom;
    #errorReport;
    #imageUrls;
    #ipcLogger;

    constructor(pageUrl) {
        this.#url = pageUrl;
        this.#state = States.INITIALISED;
        this.#states = [States.INITIALISED];
        this.#errorReport = "";
        this.#imageUrls= [];

        this.#ipcLogger = new IpcLogging.IpcLoggerClient("page.js")
        this.#ipcLogger.connect();

        this.toJSON = function() {
            return {
                url : this.#url,
                state : this.#state,
                states : this.#states,
                imageUrls : this.#imageUrls,
                errorReport: this.#errorReport,
            };
        };
    }

    getUrl() {
        return this.#url;
    }

    getState() {
        return this.#state;
    }

    setState(newState){
        // console.log(this.#url);
        // console.log(newState);

        this.#state = newState;
        this.#states.push(newState);
    }

    logMessage(message){
        //console.log(message);
        this.#ipcLogger.logMessage(message);
    }

    getDom() {
        this.logMessage("getting page " + this.#url);
        return new Promise((resolve, reject) => {
            HTTP.getDomFromUrl(this.#url).
            then((dom)=>{
                this.logMessage("got page")
                this.#state=States.FOUND;
                this.#dom =dom;
                resolve(this);}).
            catch((error)=>{
                this.#state="IN_ERROR";
                this.#errorReport = error;
                reject(this);})
        });
    }

    getAllImageUrlsFromDom(){
        const imageUrls = [];

        const imgs=this.#dom.window.document.querySelectorAll("img");
        for(const imageNode of imgs) {
            let imageUrl = imageNode.getAttribute("src");
            let divider = "";
            if (!imageUrl.startsWith("/")) {
                divider = "/";
            }
            if (!imageUrl.includes(":/")) {
                // image is relative
                imageUrl = Persist.combineIntoUrlPath(this.#url, divider, imageUrl);
                //imageUrl = this.#url + divider + imageUrl;
            }
            imageUrls.push(imageUrl);
        }

        this.#imageUrls = imageUrls;

        return imageUrls;
    }

}


module.exports ={
    States,
    Page
}