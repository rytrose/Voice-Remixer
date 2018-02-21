/* globals AudioContext, webkitAudioContext */

var WIDTH = 308;
var HEIGHT = 231;

// Interesting parameters to tweak!
var SMOOTHING = 0.8;
var FFT_SIZE = 2048;

const MAX_CONNECTIONS = 8;
var currentConnections = 0;

var mixer = new Mixer();

function loadMixer() {
    var muteAll = document.getElementById('muteAll');
    muteAll.onchange = function () {
        var sourceControl = document.getElementById('sourceControl');
        if (muteAll.checked) {
            Array.from(sourceControl.children).forEach((control) => {
                var mute = Array.from(control.children).find((el) => { return el.id.substring(0,4) == "mute"; });
                if(!mute.checked) mute.click();
                mute.disabled = true;
            });
        }
        else {
            Array.from(sourceControl.children).forEach((control) => {
                var mute = Array.from(control.children).find((el) => { return el.id.substring(0,4) == "mute"; });
                if(mute.checked) mute.click();
                mute.disabled = false;
            });
        }
    };
}

function Mixer() {
    // cope with browser differences
    if (typeof AudioContext === 'function') {
        this.context = new AudioContext();
    } else if (typeof webkitAudioContext === 'function') {
        this.context = new webkitAudioContext(); // eslint-disable-line new-cap
    } else {
        alert('Sorry! Web Audio is not supported by this browser');
    }

    this.gains = [];
    this.output = this.context.createMediaStreamDestination();
}

Mixer.prototype.addSource = function (input) {
    // If source is a stream
    if(typeof input === 'object' && input['constructor']['name'] === 'MediaStream') {
        // Create a MediaStreamAudioSourceNode from the stream
        var source = this.context.createMediaStreamSource(input);
        console.log('Created Web Audio source from remote stream: ', source);
        console.log('Number of channels from this AudioNode: ', source.channelCount);
        console.log('Connecting source to output.');
    }
    // Else source is a recording
    else {
        // Create a MediaElementAudioSourceNode from the recording
        var source = this.context.createMediaElementSource(input);
        console.log('Created Web Audio source from recording: ', source);
        console.log('Number of channels from this AudioNode: ', source.channelCount);
        console.log('Connecting source to output.');
    }

    // Add effects chain for each stream, just gains for now
    this.gains[currentConnections] = this.context.createGain();
    this.gains[currentConnections].gain.setValueAtTime(1.0, this.context.currentTime);

    // Add chain to output stream
    source.connect(this.gains[currentConnections]);
    this.gains[currentConnections].connect(this.output);

    // Add controls
    var sourceControl = document.getElementById('sourceControl');
    var newControls = document.createElement('div');
    newControls.id = 'control' + currentConnections;
    sourceControl.appendChild(newControls);

    var muteLabel = document.createElement('label');
    muteLabel.for = 'mute' + currentConnections;
    muteLabel.innerHTML = "Mute " + currentConnections + ": ";
    newControls.appendChild(muteLabel);

    var muteCheckbox = document.createElement('input');
    muteCheckbox.id = 'mute' + currentConnections;
    muteCheckbox.type = "checkbox";
    muteCheckbox.onchange = muteHandler;
    newControls.appendChild(muteCheckbox);

    var gainSlider = document.createElement('input');
    gainSlider.type = "range";
    gainSlider.id = 'gain' + currentConnections;
    gainSlider.max = 1.0;
    gainSlider.min = 0.0;
    gainSlider.step = 0.01;
    gainSlider.value = 1.0;
    gainSlider.oninput = gainHandler;
    newControls.appendChild(gainSlider);

    var muteAll = document.getElementById('muteAll');
    if(muteAll.checked) muteCheckbox.click();

    // Update number of connections
    currentConnections++;
}

var muteHandler = function (e) {
    var mute = e.target;
    var gainInd = parseInt(mute.id.charAt(4));
    var gainSlider = document.getElementById('gain' + gainInd);
    if (mute.checked) {
        gainSlider.disabled = true;
        mixer.gains[gainInd].gain.setValueAtTime(0, mixer.context.currentTime);
    }
    else {
        gainSlider.disabled = false;
        mixer.gains[gainInd].gain.setValueAtTime(parseFloat(gainSlider.value), mixer.context.currentTime);
    }
}

var gainHandler = function (e) {
    var gain = e.target;
    var gainInd = parseInt(gain.id.charAt(4));
    mixer.gains[gainInd].gain.setValueAtTime(parseFloat(gain.value), mixer.context.currentTime);
}

Mixer.prototype.getOutputStream = function () {
    return this.output.stream;
}