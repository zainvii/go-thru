const { Vonage } = require("@vonage/server-sdk");
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const Speaker = require('speaker');
const { Transform } = require('stream');

// Initialize the Vonage SDK with your credentials
const vonage = new Vonage({
  apiKey: 'c29ea64a',
  apiSecret: '0snYZUcst54vQSGy',
  applicationId: 'b026f7c6-044c-4db7-a572-212c888a379f',
  privateKey: fs.readFileSync('./private.key')
});
// const localServerUrl = 'http://localhost:3000';
// const localWsUrl = 'localhost:8080';

const localServerUrl = 'https://bccc-39-63-124-34.ngrok-free.app';
const localWsUrl = '81cd-39-63-124-34.ngrok-free.app';
// Set up the Express app
const app = express();
app.use(bodyParser.json());

// Answer URL endpoint
app.get('/answer', (req, res) => {
  const ncco = [
    {
      action: 'talk',
      text: 'You are being connected. Please wait.'
    },
    // {
    //   action: 'connect',
    //   // from: 'YOUR_VONAGE_NUMBER',
    //   endpoint: [
    //     {
    //       type: 'sip',
    //       uri: 'sip:username@sip.example.com'
    //     }
    //   ]
    // },
    {
      action: 'stream',
      streamUrl: [`ws://${localWsUrl}`]
    }
  ];

  res.json(ncco);
});

// Event URL endpoint
app.post('/event', (req, res) => {
  console.log("🚀 ~ app.post ~ req.body --> event :", req.body)
  res.sendStatus(200);
});
app.get('/ncco', (req, res) => {
  console.log("🚀 ~ app.post ~ req.body --> event :", req.body)
  res.sendStatus(200);
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

// Set up the WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  ws.on('message', (message) => {
    // Handle the incoming audio stream
    console.log('Received audio data');
    playAudioStream(message);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

console.log('WebSocket server running on ws://localhost:8080');

// Function to initiate a call
const initiateCall = async() => {

  const sip_phone = 'sip:18728880764@34.68.85.72';
  const answerUrl = [`${localServerUrl}/answer`];
  const eventUrl = [`${localServerUrl}/event`];

  // 1) conect our socket to neximo
  // 2) return every socket in answerUrl

  let nexmoAudioStreamNCCO = {
    action: "connect",
    endpoint: [
      {
        type: "websocket",
        "content-type": "audio/l16;rate=16000",
        headers: {
          app: "audiosocket",
          languageCode: "en-US",
          user: "918900408491",
        },
        uri: `ws://${localWsUrl}`,//'web_socket_url',
      },
    ],
  };

  // const callParams = {
  //   to: [{ type: "phone", number: to }],
  //   from: {
  //     type: "phone",
  //     number: session.restaurant_phone,
  //   },
  //   answer_url: [
  //     `${process.env.NEXMOHOSTNAME}/ncco?conversation_name=${session.conversation_name}&customer_uuid=${session.CALL_UUID_CUSTOMER}`,
  //   ],
  //   event_url: [`${process.env.NEXMOHOSTNAME}/event`],
  // };

  var ringToneNCCO = {
    action: "stream",
    streamUrl: ["https://s3.amazonaws.com/voixhub/RingingTone.mp3"],
  };
  let ncco = [
  //   {"action":"talk",
  //   "text":"Unfortunately our payment system is not working. Let me transfer you to the store to complete the payment step.",
  //   "premium":true,"level":"0",
  //   "style":"14","language":"en-US"
  // },
];

  // let sipNCCO = {
  //   action: "connect",
  //   from: '12063415702',
  //   endpoint: [
  //     {
  //       type: "sip",
  //       uri: sip_phone,
  //     },
  //   ],
  //   eventUrl:eventUrl
  // };
  // ncco.push(sipNCCO)
  ncco.push(ringToneNCCO);
  try {
    const call = await vonage.voice.createOutboundCall(ncco)
    console.log(call.uuid);
  } catch (error) {
    console.log("🚀 ~ initiateCall ~ error:", error);
  }

};


// Initiate the call
initiateCall();

const checkBalance = async() => {
  const balance = await vonage.accounts.getBalance();

console.log(`The current account balance is ${balance.value} ${balance.currency}`);
console.log(`Auto-reload is ${balance.autoReload ? 'enabled' : 'disabled'}`);


};

// Call the function to check balance
// checkBalance();
// Function to play the audio stream on local speakers
const playAudioStream = (audioBuffer) => {
  const speaker = new Speaker({
    channels: 1,          // Assuming mono channel for simplicity
    bitDepth: 16,         // 16-bit samples
    sampleRate: 8000      // 8 kHz sample rate (adjust as needed)
  });

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk);
      callback();
    }
  });

  transformStream.end(audioBuffer);
  transformStream.pipe(speaker);
};
