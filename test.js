const fs = require('fs');
const Speaker = require('speaker');
const JsSIP = require('jssip');
const NodeWebSocket = require('jssip-node-websocket');

const createStream = function(){
  const audioFilePath = 'dwsample-wav.wav';
  const audioStream = fs.createReadStream(audioFilePath);
  initiateAudio(audioStream);

}

const initiateAudio = function(audioStream){
  const speaker = new Speaker({
    channels: 2,         
    bitDepth: 16,        
    sampleRate: 44100    
  });
  
  audioStream.pipe(speaker);
  audioStream.on('error', (err) => {
    console.error('Error reading the audio file:', err);
  });
  speaker.on('error', (err) => {
    console.error('Error playing the audio:', err);
  });
}
 // SIP account configuration
 const ip = '16.171.19.35';
 const password = 'asdfghjkl';
 const peer = '9003001';
 const port = '8089';
 // const peer = '9003002';

 const sipConfig = {
   uri: `sip:${peer}@${ip}:${port}`,
   password: password,
   realm: `${ip}`, // Typically the same as the domain in the URI
   server: `${ip}:${port}` // SIP server address
 };

 let socket = new NodeWebSocket(`ws://${sipConfig.server}`);

 let userAgent = new JsSIP.UA(
   {
     uri          : sipConfig.uri,
     // contact_uri:  "sip:100@52.15.202.126:5060"
     password     : sipConfig.password,
     display_name : 'test',
     sockets      : [socket]
   });


const initateSip = function() {
 

  // Start JsSIP User Agent
  userAgent.start();

  // Register event listeners
  userAgent.on('registered', () => {
    console.log('SIP registration successful');
  });

  userAgent.on('connecting', () => {
    console.log('SIP trying connecting ');
  });

  userAgent.on('sipEvent', () => {
    console.log('SIP sipEvent successful');
  });

  userAgent.on('connected', () => {
    console.log('SIP connected successful');
  });

  userAgent.on('disconnected', () => {
    console.log('SIP disconnected ');
  });

  userAgent.on('registrationFailed', (error) => {
    console.error('SIP registration failed:', error);
  });

  userAgent.on('newRTCSession', (data) => {
    const session = data.session;
    console.log('New session:', session);

    // Handle incoming call
    if (session.direction === 'incoming') {
      console.log('Incoming call:', session.remote_identity.display_name);

      // Answer the call
      session.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: {
          iceServers: [],
        },
      });

      // session.connection.addEventListener('track', (event) => {
      //   const remoteStream = event.streams[0];
      //   console.log('Received audio stream:', remoteStream);

      //   // Play the received audio stream through the local speakers
      //   const audioElement = new Audio();
      //   audioElement.srcObject = remoteStream;
      //   audioElement.play();
      // });

      // Handle audio stream from the call
      session.connection.addEventListener('track', (event) => {
        const remoteStream = event.streams[0];
        console.log('Received audio stream:', remoteStream);

        // Play the received audio stream through the local speakers
        const speaker = new Speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: 48000
        });

        remoteStream.pipe(speaker);
      });
    
      // Handle audio stream from the call
      session.connection.addEventListener('addstream', (event) => {
        const audioStream = event.stream;
        console.log('Received audio stream:', audioStream);

        // Process audio stream as needed
      });
    }
  });
}

const initiateCall = function(userAgent,{target,ip,port}, res){
  const eventHandlers = {
    'progress': function(e) {
      console.log('call is in progress');
    },
    'failed': function(e) {
      console.log('call failed with cause: ' + e.data.cause);
    },
    'ended': function(e) {
      console.log('call ended with cause: ' + e.data.cause);
    },
    'confirmed': function(e) {
      console.log('call confirmed');
    }
  };

  const options = {
    eventHandlers: eventHandlers,
    mediaConstraints: { audio: true, video: false },
    pcConfig: {
      iceServers: []
    }
  };

  const session = userAgent.call(`sip:${target}@${ip}:${port}`, options);

  // Handle outgoing call audio stream
  session.connection.addEventListener('track', (event) => {
    const remoteStream = event.streams[0];
    console.log('Received audio stream:', remoteStream);

    // Play the received audio stream through the local speakers
    const speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 48000
    });

    remoteStream.pipe(speaker);
  });

  // Capture microphone audio and send it to the call
  // const record = require('node-record-lpcm16');
  // const mic = record.start({
  //   sampleRate: 48000,
  //   threshold: 0,
  //   verbose: true
  // });

  // mic.on('data', (data) => {
  //   session.connection.getSenders().forEach(sender => {
  //     if (sender.track && sender.track.kind === 'audio') {
  //       sender.replaceTrack(data);
  //     }
  //   });
  // });

}

initateSip();