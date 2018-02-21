/* globals AudioContext, webkitAudioContext */

var WIDTH = 308;
var HEIGHT = 231;

// Interesting parameters to tweak!
var SMOOTHING = 0.8;
var FFT_SIZE = 2048;

const MAX_CONNECTIONS = 8;
var currentConnections = 0;


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

Mixer.prototype.addStream = function(stream) {
  // Create a MediaStreamAudioSourceNode from the stream
  var source = this.context.createMediaStreamSource(stream);
  console.log('Created Web Audio source from remote stream: ', source);
  console.log('Number of channels from this AudioNode: ', source.channelCount);
  console.log('Connecting source to output.');

  // Add effects chain for each stream, just gains for now
  this.gains[currentConnections] = this.context.createGain();
  var mute = document.getElementById('mute');
  if(mute.checked) this.gains[currentConnections].gain.setValueAtTime(0, mixer.context.currentTime); 
  else this.gains[currentConnections].gain.setValueAtTime(1, mixer.context.currentTime);

  source.connect(this.gains[currentConnections]);
  this.gains[currentConnections].connect(this.output);
  currentConnections++;
}

Mixer.prototype.addRecording = function(recording) {
  // Create a MediaStreamAudioSourceNode from the recording
  var source = this.context.createMediaElementSource(recording);
  console.log('Created Web Audio source from recording: ', source);
  console.log('Number of channels from this AudioNode: ', source.channelCount);
  console.log('Connecting source to output.');

  // Add effects chain for each recording, just gains for now
  this.gains[currentConnections] = this.context.createGain();
  var mute = document.getElementById('mute');
  if(mute.checked) this.gains[currentConnections].gain.setValueAtTime(0, mixer.context.currentTime); 
  else this.gains[currentConnections].gain.setValueAtTime(1, mixer.context.currentTime);

  source.connect(this.gains[currentConnections]);
  this.gains[currentConnections].connect(this.output);
  currentConnections++;
}

Mixer.prototype.getOutputStream = function() {
  return this.output.stream;
}