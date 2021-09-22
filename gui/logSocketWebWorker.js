//    https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
var compressionWebSocket;
var websocketConnector;

function connectWebSocket(port){
    websocketConnector = setInterval(()=>{

        if(!compressionWebSocket) {
            compressionWebSocket = new WebSocket(`ws://localhost:${port}/`, "echo-protocol");
            compressionWebSocket.onmessage = function (event) {
                console.log("Socket progress message");
                console.log(event.data);
                var message = {action: "log", logMessages: createLogMessages((JSON.parse(event.data)))};
                postMessage(JSON.stringify(message));
            }
            compressionWebSocket.onopen = function (event) {
                compressionWebSocket.send("app:start-compression");
                console.log("connected from GUI")
                clearInterval(websocketConnector);
            }
            compressionWebSocket.onerror = function(err) {
                console.error('Socket encountered error: ', err.message, 'Closing socket');
                compressionWebSocket.close();
                compressionWebSocket=undefined;
                connectWebSocket(port);
            };
        }
        if(compressionWebSocket){
            clearInterval(websocketConnector);
        }
    }, 100);
}

function createLogMessages(messages){
    //const textArea = document.getElementById("messageresponse");
    console.log(messages);
    //textArea.innerText = message.msg + "\n" + textArea.innerText;
    let log=[];

    if(messages instanceof Array){
        for(message of messages){
            if(message.msg && message.msg.trim()!="") {
                log.push({timestamp: message.timestamp, message: message.msg})
            }else{
                if(!messages.msg) {
                    log.push({timestamp: Date.now(), message: JSON.stringify(messages)})
                }
            }
        }
    }else{
        if(messages.msg && messages.msg.trim()!="") {
            log.push({timestamp: messages.timestamp, message: messages.msg})
        }else{
            if(!messages.msg) {
                log.push({timestamp: Date.now(), message: JSON.stringify(messages)})
            }
        }
    }

    return log;
}


onmessage = (event)=>{
    message = JSON.parse(event.data);

    if(message.action==="connect"){
        connectWebSocket(message.port);
    }
    if(message.action==="close"){
        if(compressionWebSocket){
            clearInterval(websocketConnector);
            compressionWebSocket.close();
            compressionWebSocket=undefined;
            close();
        }
    }
}