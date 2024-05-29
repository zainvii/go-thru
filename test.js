const fs = require('fs');
const Speaker = require('speaker');
const JsSIP = require('jssip');
const NodeWebSocket = require('jssip-node-websocket');

// SIP account configuration
const ip = '34.67.132.35';
const password = 'asd32EASdYKfL';
const peer = 'tribe-demo';
const port = '5060';

const sipConfig = {
  uri: `sip:${peer}@${ip}:${port}`,
  password: password,
  realm: `${ip}`, // Typically the same as the domain in the URI
  server: `${ip}:${port}` // SIP server address
};

let socket = new NodeWebSocket(`ws://${sipConfig.server}`);

let userAgent = new JsSIP.UA({
  uri: sipConfig.uri,
  password: sipConfig.password,
  display_name: 'test',
  sockets: [socket]
  // sockets: [new JsSIP.WebSocketInterface(`ws://${ip}:${port}`)],

});

const initiateSip = function () {
  // Start JsSIP User Agent
  userAgent.start();

  // Register event listeners
  userAgent.on('registered', () => {
    console.log('SIP registration successful');
    initiateCall(userAgent, { target: 'destination', ip: sipConfig.server, port: sipConfig.port });
  });

  userAgent.on('connecting', () => {
    console.log('SIP trying connecting');
  });

  userAgent.on('sipEvent', () => {
    console.log('SIP sipEvent successful');
  });

  userAgent.on('connected', () => {
    console.log('SIP connected successful');
  });

  userAgent.on('disconnected', () => {
    console.log('SIP disconnected');
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

      session.connection.addEventListener('track', (event) => {
        const remoteStream = event.streams[0];
        console.log('Received audio stream:', remoteStream);

        // Play the received audio stream through the local speakers
        const speaker = new Speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: 48000
        });

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(remoteStream);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const audioStream = destination.stream;
        audioStream.pipe(speaker);
      });

      session.connection.addEventListener('addstream', (event) => {
        const audioStream = event.stream;
        console.log('Received audio stream:', audioStream);

        // Process audio stream as needed
      });
    }
  });
}

const initiateCall = function (userAgent, { target, ip, port }) {
  const eventHandlers = {
    'progress': function (e) {
      console.log('call is in progress');
    },
    'failed': function (e) {
      console.log('call failed with cause: ' + e.data.cause);
    },
    'ended': function (e) {
      console.log('call ended with cause: ' + e.data.cause);
    },
    'confirmed': function (e) {
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

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(remoteStream);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);

    const audioStream = destination.stream;
    audioStream.pipe(speaker);
  });
}

initiateSip();
