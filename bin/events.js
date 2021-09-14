
// type e.g. "log"

const EventType = {
    LOG : "log",
    IMAGE : "image"
};

function log(aMessage){
    const anEvent = new Event(EventType.LOG);
    anEvent.message = aMessage;
    return anEvent;
}

class Event{

    timestamp = Date.now();

    constructor(eventType){
        this.type = eventType;
    }

    get timestamp(){
        return this.timestamp;
    }

    set message(aMessage){
        this.msg = aMessage;
    }

    get message(){
        return this.msg;
    }

    set object(anObject){
        this.myObject = anObject;
    }

    setObject(anObject){
        this.myObject = anObject;
        return this;
    }

    get object(){
        return this.myObject;
    }
}

class EventsRegister{

    constructor(){
        this.listeners = {};
        this.chain = [];
    }

    registerListener(listenerName, callback){
        this.listeners[listenerName] = callback;
        for(const eventRegister of this.chain){
            eventRegister.registerListener(listenerName, callback);
        }
    }

    removeListener(listenerName){
        delete this.listeners[listenerName];
        for(const eventRegister of this.chain){
            eventRegister.removeListener(listenerName);
        }
    }

    alertListeners(event){
        for(const callbackName of Object.getOwnPropertyNames(this.listeners)){
            new Promise((resolve, reject)=>{
                this.listeners[callbackName](event);
                resolve(event);
                }
            ).catch((error)=>{console.log("alert Failed");console.log(error)});
        }
    }

    includeInRegisterChain(eventsRegister){
        this.chain.push(eventsRegister);
    }

}

module.exports = {
    Register : EventsRegister,
    Event: Event,
    newLogEvent : log
}