/* globals AudioContext, webkitAudioContext */

var WIDTH = 308;
var HEIGHT = 231;

// Interesting parameters to tweak!
var SMOOTHING = 0.8;
var FFT_SIZE = 2048;

function Mixer(stream) {
  // cope with browser differences
  if (typeof AudioContext === 'function') {
    this.context = new AudioContext();
  } else if (typeof webkitAudioContext === 'function') {
    this.context = new webkitAudioContext(); // eslint-disable-line new-cap
  } else {
    alert('Sorry! Web Audio is not supported by this browser');
  }

  // Create a MediaStreamAudioSourceNode from the stream
  this.source = this.context.createMediaStreamSource(stream);
  console.log('Created Web Audio source from remote stream: ', this.source);
}

StreamVisualizer.prototype.start = function() {
  requestAnimationFrame(this.draw.bind(this));
};

StreamVisualizer.prototype.draw = function() {
  this.analyser.smoothingTimeConstant = SMOOTHING;
  this.analyser.fftSize = FFT_SIZE;

  // Get the frequency data from the currently playing music
  this.analyser.getByteFrequencyData(this.freqs);
  this.analyser.getByteTimeDomainData(this.times);


  this.canvas.width = WIDTH;
  this.canvas.height = HEIGHT;
  // Draw the frequency domain chart.
  for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
    var value = this.freqs[i];
    var percent = value / 256;
    var height = HEIGHT * percent;
    var offset = HEIGHT - height - 1;
    var barWidth = WIDTH/this.analyser.frequencyBinCount;
    var hue = i/this.analyser.frequencyBinCount * 360;
    this.drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
    this.drawContext.fillRect(i * barWidth, offset, barWidth, height);
  }

  // Draw the time domain chart.
  for (i = 0; i < this.analyser.frequencyBinCount; i++) {
    value = this.times[i];
    percent = value / 256;
    height = HEIGHT * percent;
    offset = HEIGHT - height - 1;
    barWidth = WIDTH/this.analyser.frequencyBinCount;
    this.drawContext.fillStyle = 'white';
    this.drawContext.fillRect(i * barWidth, offset, 1, 2);
  }

  requestAnimationFrame(this.draw.bind(this));
};

StreamVisualizer.prototype.getFrequencyValue = function(freq) {
  var nyquist = this.context.sampleRate/2;
  var index = Math.round(freq/nyquist * this.freqs.length);
  return this.freqs[index];
};