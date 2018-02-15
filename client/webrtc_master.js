var localVideo;
var localStream;
var remoteVideo;
var peerConnections = {};
var uuid;
var serverConnection;
var numVideos = 0;
var streamsGotten = 0;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.services.mozilla.com'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

function pageReady() {
  uuid = createUUID();
  document.getElementById('masterId').innerHTML = uuid;

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
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
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
        
        peerConnection.createAnswer().then(
          function (description) {
            console.log('got description');

            peerConnection.setLocalDescription(description).then(function() {
              serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
            }).catch(errorHandler);
          }).catch(errorHandler);
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

function gotRemoteStream(event) {
  console.log('got remote stream');
  var video_div = document.getElementById('remoteVideos');
  if(streamsGotten == 0) {
    var new_video = document.createElement('video');
    var new_video_id = "remoteVideo" + numVideos;
    new_video.id = new_video_id;
    new_video.autoplay = true;
    new_video.style.width = "40%";
    new_video.srcObject = event.streams[0];  
    video_div.append(new_video);
    streamsGotten++;
  } else {
    var str = 'remoteVideo' + numVideos;
    var new_video = document.getElementById(str);
    new_video.srcObject = event.streams[0];
    streamsGotten = 0; 
    numVideos++;
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

