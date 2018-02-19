var localVideo;
var localStream;
var remoteVideo;
var peerConnections = {};
var uuid;
var serverConnection;
var numPeers = 0;
var streamsGotten = 0;
var mixer = new Mixer();

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.services.mozilla.com'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

window.onload = function() {

  uuid = createUUID();
  document.getElementById('masterId').innerHTML = uuid;

  var mute = document.getElementById('mute');
  mute.onchange = function() {
    if(mute.checked) {
      mixer.gains.forEach((gain) => {
        gain.gain.setValueAtTime(0, mixer.context.currentTime);  
      });
    }
    
    else {
      mixer.gains.forEach((gain) => {
        gain.gain.setValueAtTime(1, mixer.context.currentTime);  
      });
    }
  };

  localVideo = document.getElementById('localVideo');

  serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
  serverConnection.onmessage = gotMessageFromServer;

  // Tell server what UUID this client is
  serverConnection.onopen = () => serverConnection.send(JSON.stringify({'identify': true, 'uuid': uuid}));

  var constraints = {
    video: true,
    audio: true,
  };

  if(navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
};

function getUserMediaSuccess(stream) {
  localStream = stream;
  
  // Add local stream to mixer
  mixer.addStream(localStream);

  // Get the mixed audio stream from mixer
  var streamFromMixer = mixer.getOutputStream();

  // Remove the original audio track from local stream
  localStream.removeTrack(localStream.getAudioTracks()[0]);

  // Add the mixer audio track to local stream
  localStream.addTrack(streamFromMixer.getAudioTracks()[0]);

  // Add VowelWorm
  var worm = new window.VowelWorm.instance(localStream);
  window.vw.addWorm(worm, localStream);

  // Add to Tonejs
  var toneStream = new Tone.UserMedia();
  toneStream.openMediaStream(streamFromMixer);
  toneStream.toMaster();
}

function start(signal) {
  var peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
  peerConnection.addStream(localStream);
  peerConnections[signal.uuid] = peerConnection;
}

function gotMessageFromServer(message) {
  var signal = JSON.parse(message.data);

  // Ignore messages from ourself
  if(signal.uuid == uuid) return;
 
  if(signal.sdp) {
    start(signal);
    var peerConnection = peerConnections[signal.uuid];
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
      // Only create answers in response to offers
      if(signal.sdp.type == 'offer') {
        
        if(numPeers < MAX_CONNECTIONS) {
          peerConnection.createAnswer().then(
          function (description) {
            console.log('got description');

            peerConnection.setLocalDescription(description).then(function() {
              serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
            }).catch(errorHandler);
          }).catch(errorHandler);
        } else { alert("Only " + MAX_CONNECTIONS + " connections are allowed.")}
      }
    }).catch(errorHandler);
  } else if(signal.ice) {
    var peerConnection = peerConnections[signal.uuid];
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event) {
  if(event.candidate != null) {
    serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
  }
}

var remoteStream;

function gotRemoteStream(event) {
  console.log('got remote stream');
  
  // First track event
  if(!remoteStream) {
    remoteStream = new MediaStream([event.track]);
    if(event.track.kind == "audio") {
      mixer.addStream(event.streams[0]);  
    } 
  }
  // Second track event
  else {
    remoteStream.addTrack(event.track);
    if(event.track.kind == "audio") mixer.addStream(event.streams[0]); 
    var worm = new window.VowelWorm.instance(remoteStream);
    window.vw.addWorm(worm, remoteStream);  
    numPeers++;
  }
}

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

