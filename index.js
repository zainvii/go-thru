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

 const initateSip = function(){
  // SIP account configuration
const sipConfiga = {
  uri: 'sip:9003002@13.60.56.248:8089',
  password: 'asdfghjkl',
  realm: '13.60.56.248', // Typically the same as the domain in the URI
  server: '13.60.56.248:8089' // SIP server address
};

const sipConfig = {
  uri: 'sip:mypeer@localhost:8089',
  password: 'mySecretPassword',
  realm: 'localhost', // Typically the same as the domain in the URI
  server: 'localhost:8089' // SIP server address
};

// WebSocket configuration
// const socket = new JsSIP.WebSocketInterface(`ws://${sipConfig.server}`);

let socket = new NodeWebSocket(`ws://${sipConfig.server}`);

// Create a new JsSIP User Agent
// const userAgent = new JsSIP.UA({
//   uri: sipConfig.uri,
//   sockets: [socket], // Provide the WebSocket(s) configuration
//   authorization_user: sipConfig.uri,
//   password: sipConfig.password,
//   realm: sipConfig.realm,
// });

let userAgent = new JsSIP.UA(
  {
    uri          : sipConfig.uri,
    // contact_uri:  "sip:100@52.15.202.126:5060"
    password     : sipConfig.password,
    display_name : 'test',
    sockets      : [socket]
  });

// Start JsSIP User Agent
userAgent.start();

// Register event listeners
userAgent.on('registered', () => {
  console.log('SIP registration successful');
});

userAgent.on('connecting', () => {
  console.log('SIP connecting successful');
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

    // Handle audio stream from the call
    session.connection.addEventListener('addstream', (event) => {
      const audioStream = event.stream;
      console.log('Received audio stream:', audioStream);

      // Process audio stream as needed
    });
  }
});
 }

// initateSip()

createStream()
