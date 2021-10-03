const Ipc = require('node-ipc');
const Events = require("../logging/Events");

class IpcLoggerClient{

    constructor(clientId) {
        this.ipc =  new Ipc.IPCModule();
        this.ipc.config.id = clientId;
        this.ipc.config.retry= 1500;

    }

    connect(){
        const ipc=this.ipc;
        ipc.connectTo(
            'world',
            function(){
                ipc.of.world.on(
                    'connect',
                    function(){
                        ipc.log('## connected to world ##', ipc.config.delay);
                        ipc.of.world.emit(
                            'app.message',
                            {
                                id      : ipc.config.id,
                                message : 'connect from ' + ipc.config.id
                            }
                        );
                    }
                );
                ipc.of.world.on(
                    'disconnect',
                    function(){
                        ipc.log('disconnected from world');
                    }
                );
                ipc.of.world.on(
                    'app.message',
                    function(data){
                        ipc.log('got a message from world : ', data);
                    }
                );
                ipc.of.world.on(
                    'kill.connection',
                    function(data){
                        ipc.log('world requested kill.connection');
                        ipc.disconnect('world');
                    }
                );
            });
    }

    close(){
        ipc.disconnect('world');
    }

    logMessage(message){
        this.ipc.of.world.emit(
            'app.message',
            {
                id      : this.ipc.config.id,
                message : message
            }
        );
    }

}

module.exports = {
    IpcLoggerClient
}