/* globals AudioContext, webkitAudioContext */

var WIDTH = 308;
var HEIGHT = 231;

// Interesting parameters to tweak!
var SMOOTHING = 0.8;
var FFT_SIZE = 2048;

const MAX_CONNECTIONS = 2;
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
  this.merger = this.context.createChannelMerger(2 * (MAX_CONNECTIONS + 1));
  this.output = this.context.createMediaStreamDestination();
  this.merger.connect(this.output);
}

Mixer.prototype.addStream = function(stream) {
  // Create a MediaStreamAudioSourceNode from the stream
  this.source = this.context.createMediaStreamSource(stream);
  console.log('Created Web Audio source from remote stream: ', this.source);
  console.log('Number of channels from this AudioNode: ', this.source.channelCount);
  console.log('Connecting source to output.');

  // Add effects chain for each stream, just gains for now
  this.gains[currentConnections] = this.context.createGain();
  this.source.connect(this.gains[currentConnections]);
  this.gains[currentConnections].connect(this.merger, 0, currentConnections);
  currentConnections++;
}

Mixer.prototype.getOutputStream = function() {
  return this.output.stream;
}