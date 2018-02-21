var recording = false;
var recordingChunks = [];

/*
 * On page load
 */
window.onload = function () {
    loadMixer();
    loadWebRTC();
    loadRecording();
    loadP5();
};

function loadRecording() {
    /*
     *  recording
     */
    var recordButton = document.getElementById('record');

    recordButton.onclick = function (e) {

        // Start recording
        if (!recording) {
            recorder.start();
            recordButton.innerHTML = "Stop Recording";
            recording = true;
        }

        // Stop recording
        else {
            recorder.stop();
            recordButton.innerHTML = "Record";
            recording = false;
        }

    }
}

function loadP5() {
    var s = function (p5, vw) {
        window.vw = new window.VowelWorm.Game(p5);

        p5.preload = function () {
            window.maskImage = p5.loadImage('53WpV.png');
        }

        p5.setup = function () {
            p5.createCanvas(p5.windowHeight, p5.windowHeight);
        }

        p5.draw = function () {
            p5.background(255);
            window.vw.draw();
        }
    }

    var myP5 = new p5(s, 'sketch');
}





