class QManager{

    constructor(qNamesToCreate){

        this.QNames = qNamesToCreate.map(name => name);
        this.Qs = {};

        for(const qNameToCreate of qNamesToCreate){
            this.Qs[qNameToCreate] = []
        }
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
        for(const qName of Object.getOwnPropertyNames(this.Qs)){
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

        for(const qName of Object.getOwnPropertyNames(this.Qs)){
            reportLines.push(qName)
            reportLines.push("----------------");
            reportLines.push(this.reportOnQueueContents(qName));
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

module.exports = {QManager};