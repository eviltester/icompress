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

    alertListeners(alert){
        for(const callbackName of Object.getOwnPropertyNames(this.listeners)){
            this.listeners[callbackName](alert);
        }
    }

    includeInRegisterChain(eventsRegister){
        this.chain.push(eventsRegister);
    }

}

module.exports = {
    Register : EventsRegister
}