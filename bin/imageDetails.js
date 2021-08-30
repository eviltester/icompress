module.exports = class ImageDetails{

    constructor(){
        this.state = "INITIALISED"
        this.states = ["INITIALISED"];
        this.src = "";
        this.errorReport = "";
    }

    setState(newState){

        console.log(this.src);
        console.log(newState);

        this.state = newState;
        this.states.push(newState);
    }

    addErrorReport = (error)=> {
        console.log(error);
        this.errorReport = error;
    };

    setSrc(aUrl) {
        this.src = aUrl;
    }

    setFullFilePath(inputName) {
        this.fullFilePath = inputName;
    }
}