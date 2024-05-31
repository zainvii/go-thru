const dgram = require('dgram');
const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const Speaker = require('speaker');
const wav = require('wav');
const rtpParser  = require('rtp-parser'); // Placeholder for RTP parsing logic
const recorder = require('node-record-lpcm16');
const mic = require('mic');
const portfinder = require('portfinder');
const { Readable } = require('stream'); // Import Readable from the stream module

portfinder.basePort = 10000;
portfinder.highestPort = 60000;
// Decode G.711 PCMU (mu-law) to PCM
function decodePCMU(pcmuBuffer) {
  const pcmBuffer = Buffer.alloc(pcmuBuffer.length * 2);

  for (let i = 0; i < pcmuBuffer.length; i++) {
    const pcmu = pcmuBuffer[i];
    pcmBuffer.writeInt16LE(muLawDecode(pcmu), i * 2);
  }

  return pcmBuffer;
}

function muLawDecode(value) {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;
  value = ~value;
  let sign = (value & 0x80);
  let exponent = (value >> 4) & 0x07;
  let mantissa = value & 0x0F;
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  if (sign !== 0) sample = -sample;
  return sample;
}

// Decode G.711 PCMA (A-law) to PCM
function decodePCMA(pcmaBuffer) {
  const pcmBuffer = Buffer.alloc(pcmaBuffer.length * 2);

  for (let i = 0; i < pcmaBuffer.length; i++) {
    const pcma = pcmaBuffer[i];
    pcmBuffer.writeInt16LE(aLawDecode(pcma), i * 2);
  }

  return pcmBuffer;
}

function aLawDecode(value) {
  value ^= 0x55;
  let sign = value & 0x80;
  let exponent = (value & 0x70) >> 4;
  let data = value & 0x0F;
  data <<= 4;
  data += 8;
  if (exponent !== 0) {
    data += 0x100;
    if (exponent > 1) data <<= (exponent - 1);
  }
  return (sign === 0x80) ? -data : data;
}
function getCodecType(payloadType) {
  if (payloadType === 0) { // Payload type 0 for PCMU
    return 'PCMU';
  } else if (payloadType === 8) { // Payload type 8 for PCMA
    return 'PCMA';
  } else {
    return 'UNKNOWN';
  }
}




// Function to find two available ports
const findTwoPorts = async () => {
  try {
    const port1 = await portfinder.getPortPromise();
    console.log(`Found first available port: ${port1}`);

    // To ensure the second port is different, set the basePort to port1 + 1
    portfinder.basePort = port1 + 1;
    const port2 = await portfinder.getPortPromise();
    console.log(`Found second available port: ${port2}`);

    return { port1, port2 };
  } catch (err) {
    console.error(`Error finding ports: ${err.message}`);
  }
};
const micInstance = mic({
  rate: '16000',
  channels: '1',
  debug: true,
  exitOnSilence: 6
});

const username = 'tribe-demo';
const password = 'asd32EASdYKfL';
const realm = '34.67.132.35';
const sipServer = '34.67.132.35';
const myIp = '3.217.139.195'
const myProxy = '10.8.0.15';
const sipServerPort = 5060;
const target = 'sip:18722990045@34.67.132.35';
const destination = '18722990045';
// Create a UDP socket
const socket = dgram.createSocket('udp4');
const wavReader = new wav.Reader();

wavReader.on('format', (format) => {
  console.log("🚀 ~ wavReader.on ~ format:", format)
  // wavReader.pipe(speaker);
});
// Generate a random Call-ID and CSeq
const callId = crypto.randomBytes(16).toString('hex');
let cseq = 1;

// Generate a unique tag
const tag = crypto.randomBytes(8).toString('hex');

// Define the local SIP URI
const localUri = `sip:${username}@${realm}`;

// Define the contact URI
const contactUri = `sip:${username}@${myIp}`;

// dynamicallyAssignedRtpPort=64582
// let dynamicallyAssignedRtpPort=58637

let alredy=[]
let issend = false
// Listen for incoming messages from the SIP server
socket.on('message', (message, rinfo) => {
  console.log('Received message:\n', message.toString());
  const response = message.toString();

  if (response.includes('401 Unauthorized')) {
    const authenticateHeader = parseWWWAuthenticate(response);
    const authorizationHeader = generateAuthorizationHeader(authenticateHeader);
    sendAuthenticatedRegister(authorizationHeader, regPort);
  } else if (response.includes('200 OK') &&  response.includes('REGISTER')) {
    // Registration successful, initiate the call
    sendSIPMessage(createInviteMessage(dynamicallyAssignedRtpPort, regPort));
  } else if (response.includes('100 Trying')) {
    // Handling 100 Trying: simply log it and wait for further responses
    console.log('Call is trying...');

  } else if (response.includes('180 Ringing')) {
    // Handling 180 Ringing: log it
    console.log('Call is ringing...');
  } else if (response.includes('200 OK') && response.match(/CSeq: (\d+) INVITE/)) {
    console.log('Call initiated successfully. Waiting for RTP packets...');

    const callIdMatch = response.match(/Call-ID: (.*)/);
    const cseqMatch = response.match(/CSeq: (\d+) INVITE/);
    const callId = callIdMatch ? callIdMatch[1] : '';
    const cseq = cseqMatch ? cseqMatch[1] : '';
    // const testv = createInviteMessage(dynamicallyAssignedRtpPort, regPort)
    const ackMessage = getACK(cseq, callId, regPort)
    //  `ACK sip:${destination}@${sipServer} SIP/2.0
    // Via: SIP/2.0/UDP ${myProxy};branch=z9hG4bK776asdhds
    // Max-Forwards: 70
    // From: "${username}" <sip:${username}@${sipServer}>;tag=456248
    // To: "${destination}" <sip:${destination}@${sipServer}>;tag=abcd1234
    // Call-ID: ${callId}
    // CSeq: ${cseq} ACK
    // Contact: <sip:${username}@${myIp}>
    // Content-Length: 0
    // `.trim();
    sendSIPMessage(ackMessage);
    const sdp = extractSDP(response);
    const audioDetails = extractAudioDetails(sdp);
    console.log('Audio Details:', audioDetails);
    sendPort = audioDetails.port;
    sendIp = audioDetails.ip;
    // sendMicrophoneData(audioDetails.port,audioDetails.ip);
    // if(!alredy.includes(audioDetails.port)) {
    //     startRTPListening(audioDetails);
    //     alredy.push(audioDetails.port);
    // }
    console.log('Call established.');
  } else if (message.toString('utf8').match(/CSeq: (\d+) INVITE/)) {
        console.log('Received SIP INVITE message:');
        console.log(message.toString('utf8'));
        console.log('Sender address:', rinfo.address);
        console.log('Sender port:', rinfo.port);
        const sdp = extractSDP(message.toString('utf8'));
        const audioDetails = extractAudioDetails(sdp);
        console.log('Audio Details:', audioDetails);
        sendPort = audioDetails.port;
    sendIp = audioDetails.ip;
        // sendMicrophoneData(audioDetails.port,audioDetails.ip);
        // const rtpPacket = parseRtpPacket(msg);
        // wavReader.write(message);
        const callId = message.toString('utf8').match(/Call-ID:\s*(.*)/)[1].trim();
        const cSeq = message.toString('utf8').match(/CSeq:\s*(\d+)\s*INVITE/)[1].trim();
        const fromTag = message.toString('utf8').match(/From:.*;tag=([\w\d]+)/)[1].trim();
        const viaBranch = message.toString('utf8').match(/Via: SIP\/2\.0\/UDP [\d\.]+:\d+;branch=([\w\d]+)/)[1].trim();
        const contact = message.toString('utf8').match(/Contact:\s*<([^>]+)>/)[1].trim();
        const to = message.toString('utf8').match(/To:\s*<([^>]+)>/)[1].trim();
        const ackMessage = getACK(cseq, callId)
        if(!issend){
            const invite200Message = createInvite200Message(cSeq,callId);
            sendSIPMessage(invite200Message);
            issend=true
        }else{
            sendSIPMessage(ackMessage);
        }
        
        if(!alredy.includes(audioDetails.port)) {
            // startRTPListening(audioDetails);
            alredy.push(audioDetails.port);
        }
        // const ackMessage = `
        // ACK sip:tribe-demo@${myIp}:${audioDetails.port};transport=UDP SIP/2.0
        // Via: SIP/2.0/UDP ${myProxy};branch=z9hG4bK${viaBranch}
        // From: <sip:18722990045@${sipServer}>;tag=${fromTag}
        // To: ${to};tag=9b2c7a2d
        // Call-ID: ${callId}
        // CSeq: ${cSeq} ACK
        // Contact: <sip:18722990045@${sipServer}>
        // Max-Forwards: 70
        // Content-Length: 0
        // `.trim();
       
        // if(!alredy.includes(audioDetails.port)) {
        //     startRTPListening(audioDetails);
        //     alredy.push(audioDetails.port);
        // }
       
        // sendSIPMessage(ackMessage);
        // sendAck(rinfo.address, rinfo.port);
  } else if (response.match(/CSeq: (\d+) BYE/)) {
    // Handle BYE: send OK
    const byeOkMessage = `SIP/2.0 200 OK
    Via: ${response.match(/Via: (.*)/)[1]}
    To: ${response.match(/To: (.*)/)[1]}
    From: ${response.match(/From: (.*)/)[1]}
    Call-ID: ${response.match(/Call-ID: (.*)/)[1]}
    CSeq: ${response.match(/CSeq: (.*)/)[1]}
    User-Agent: CustomSipClient
    Content-Length: 0
`;
    sendSIPMessage(byeOkMessage);
    console.log('Call ended.');
  } else if (response.match(/CSeq: (\d+) OPTIONS/)) {
    handleOptions(response, rinfo);
  }
});

// Keep the program running
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let regPort = 50760
// findTwoPorts().then((ports) => {
//   if (ports) {
//     console.log(`Ports found: ${ports.port1}, ${ports.port2}`);
//     dynamicallyAssignedRtpPort = ports.port1;
//     regPort=ports.port2;
let dynamicallyAssignedRtpPort=57202
    // receiveAudioData(dynamicallyAssignedRtpPort, '0.0.0.0')
// 
    // You can now use these ports for your application
//   }
// });

// const registerUser = dgram.createSocket('udp4');
// // Bind to the specified port and listen for RTP packets
// registerUser.on('message', (message, rinfo) => {
//   console.log('Received message registerUser:\n', message.toString());
// })
// registerUser.on('listening', () => {
//   const address = registerUser.address();
//   // sendSIPMessage(createRegisterMessage(regPort));
  
//   console.log(`UDP register server listening on ${address.address}:${address.port}`);
// });
// registerUser.bind(regPort,"0.0.0.0")

socket.on('listening', () => {
  const address = socket.address();
  sendMicrophoneData()
  receiveAudioData(dynamicallyAssignedRtpPort, '0.0.0.0')
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

socket.bind(regPort,"0.0.0.0")

const sendSocket = dgram.createSocket('udp4');
let micStarted = false;
let sendPort = '' 
let sendIp = ''
// Function to send microphone data to IP2:PORT2
function sendMicrophoneData() {
    // Capture audio from microphone
    const micInputStream = micInstance.getAudioStream();
    micInputStream.on('data', (data) => {
      // console.log('Receiving audio data:', data.length);
      // console.log("🚀 ~ mic.on ~ chunk:", data)
      if(!!sendIp && !!sendPort) {
        console.log('send audio data:', data.length, sendPort, sendIp);
        recvSocket.send(data, sendPort, sendIp, (err) => {
          if (err) {
              console.error('Error sending audio data:', err);
          }
        });
      }
    });
    micInputStream.on('error', (err) => {
      console.error('Error in Input Stream:', err);
    });
    
    micInputStream.on('startComplete', () => {
      console.log('Recording Started');
    });
    
    micInputStream.on('stopComplete', () => {
      console.log('Recording Stopped');
    });
    
    micInputStream.on('silence', () => {
      console.log('Silence detected');
    });
    
    micInputStream.on('processExitComplete', () => {
      console.log('Process Exited');
    });
    if(!micStarted){
      // Start recording
    micInstance.start();
    micStarted = true
    }
    
    // setTimeout(() => {
    //   micInstance.stop();
    // }, 10000);
    return;
    const mic = recorder.record({
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16
    }).start();

    mic.stream().on('data', (chunk) => {
        console.log("🚀 ~ mic.on ~ chunk:", chunk)
        sendSocket.send(chunk, PORT, IP, (err) => {
            if (err) {
                console.error('Error sending audio data:', err);
            }
        });
    });

    mic.stream().on('error', (err) => {
        console.error('Microphone error:', err);
    });

    console.log(`Sending microphone data to ${IP}:${PORT}`);
}

const recvSocket = dgram.createSocket('udp4');
function receiveAudioData(PORT, IP) {
  function parseRtpPacket(msg) {
    const headerLength = 12;
    return {
      payload: msg.slice(headerLength)
    };
    }
  recvSocket.on('message', (msg) => {

    const payloadType = msg[1] & 0x7F;
    const payload = parseRtpPacket(msg).payload;
    const codecType = getCodecType(payloadType);
    let decodedAudio;
    if (codecType === 'PCMU') {
      decodedAudio = decodePCMU(payload);
    } else if (codecType === 'PCMA') {
      decodedAudio = decodePCMA(payload);
    } else {
      console.error('Unsupported codec type:', payloadType);
      return;
    }
    speaker.write(decodedAudio)
   
  });

  recvSocket.on('listening', () => {
      const address = recvSocket.address();
      sendSIPMessage(createRegisterMessage(regPort));
      console.log(`Listening for audio data on ${address.address}:${address.port}`);
  });

  recvSocket.on('error', (err) => {
      console.error('Receive socket error:', err);
      recvSocket.close();
  });

  recvSocket.bind(PORT, IP);

  // Create a speaker instance to play audio
  const speaker = new Speaker({
    channels: 1,          // Mono
    bitDepth: 16,         // 16-bit audio
    sampleRate: 8000      // Adjust sample rate as per your RTP data
  });
  let buffer = Buffer.alloc(0);
}


// =============================================

function sendAck(address, port) {
  const ackMessage = `ACK sip:${address}:${port} SIP/2.0\r\n\r\n`;

  const client = dgram.createSocket('udp4');
  client.send(Buffer.from(ackMessage), port, address, (err) => {
      if (err) {
          console.error('Error sending ACK:', err);
      } else {
          console.log('ACK sent successfully');
      }
      client.close();
  });
}
function extractSDP(sipMessage) {
  const sdpIndex = sipMessage.indexOf('\r\n\r\n') + 4; // Find the start of SDP after the empty line
  return sipMessage.substring(sdpIndex);
}
// Function to extract audio details from SDP
function extractAudioDetailsss(sdp) {
const lines = sdp.split('\r\n');
let audioDetails = {};

lines.forEach(line => {
  if (line.startsWith('m=audio')) {
    const parts = line.split(' ');
    audioDetails.port = parseInt(parts[1]);
  } else if (line.startsWith('c=')) {
    const parts = line.split(' ');
    audioDetails.ip = parts[2];
  }
});

return audioDetails;
}

function extractAudioDetails(sdp) {
const lines = sdp.split('\n');
const audioInfo = {
  ip: null,
  port: null
};

lines.forEach(line => {
  if (line.startsWith('c=IN IP4')) {
    const parts = line.split(' ');
    audioInfo.ip = parts[2].trim();
  } else if (line.startsWith('m=audio')) {
    const parts = line.split(' ');
    audioInfo.port = parseInt(parts[1].trim(), 10);
  }
});

return audioInfo;
}

// Function to handle SIP OPTIONS
function handleOptions(response, rinfo) {
const callIdMatch = response.match(/Call-ID: (.*)/);
const cseqMatch = response.match(/CSeq: (\d+) OPTIONS/);
const callId = callIdMatch ? callIdMatch[1] : '';
const cseq = cseqMatch ? cseqMatch[1] : '';

const optionsResponse = `SIP/2.0 200 OK
Via: SIP/2.0/UDP ${rinfo.address}:${rinfo.port};received=${rinfo.address};branch=z9hG4bK776asdhds;rport=${rinfo.port}
To: <sip:${username}@${sipServer}>;tag=as73a67a1f
From: "asterisk" <sip:asterisk@${sipServer}>;tag=as73a67a1f
Call-ID: ${callId}
CSeq: ${cseq} OPTIONS
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, SUBSCRIBE, NOTIFY, INFO, PUBLISH, MESSAGE
Supported: replaces, timer
User-Agent: CustomSipClient
Content-Length: 0
`.trim();

socket.send(optionsResponse, rinfo.port, rinfo.address, (err) => {
  if (err) {
    console.error('Error sending SIP OPTIONS response:', err);
    socket.close();
  } else {
    console.log('SIP OPTIONS response sent successfully.');
  }
});
}
// Listen for RTP Packets
function startRTPListening(audioDetails) {

  // Create UDP socket
const socketRTP = dgram.createSocket('udp4');

// Configure speaker
const speaker = new Speaker({
channels: 1,          // 1 channel (mono)
bitDepth: 16,         // 16-bit samples
sampleRate: 8000      // 8,000 Hz sample rate (PCMU/PCMA are usually 8000 Hz)
});

// Function to parse RTP packet
function parseRtpPacket(msg) {
const headerLength = 12; // RTP header length is typically 12 bytes
return {
  payload: msg.slice(headerLength) // Extract payload after RTP header
};
}

// Function to handle incoming RTP packets
socketRTP.on('message', (msg, rinfo) => {
console.log(`RTP packet received from ${rinfo.address}:${rinfo.port}`);

// Parse the RTP packet
const rtpPacket = parseRtpPacket(msg);

// Write the audio payload to the speaker
speaker.write(rtpPacket.payload);
});

// Error handling
socketRTP.on('error', (err) => {
console.error(`RTP socket error: ${err.message}`);
socket.close();
});


socketRTP.on('listening', () => {
  const address = socketRTP.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

// Bind to the specified port and listen for RTP packets
socketRTP.bind(audioDetails.port, '0.0.0.0');

}

// Parse WWW-Authenticate header
function parseWWWAuthenticate(response) {
const wwwAuthHeader = response.match(/WWW-Authenticate: Digest (.*)/i)[1];
const params = {};
wwwAuthHeader.split(',').forEach(part => {
  const [key, value] = part.trim().split('=');
  params[key] = value.replace(/"/g, '');
});
return params;
}

// Generate Authorization header
function generateAuthorizationHeader(auth) {
const ha1 = crypto.createHash('md5').update(`${username}:${auth.realm}:${password}`).digest('hex');
const ha2 = crypto.createHash('md5').update(`REGISTER:sip:${sipServer}`).digest('hex');
const response = crypto.createHash('md5').update(`${ha1}:${auth.nonce}:${ha2}`).digest('hex');

return `
Authorization: Digest username="${username}", realm="${auth.realm}", nonce="${auth.nonce}", uri="sip:${sipServer}", response="${response}"
`.trim();
}

// Send authenticated REGISTER
function sendAuthenticatedRegister(authorizationHeader, regPort) {
const authenticatedRegisterMessage = `
REGISTER sip:${realm} SIP/2.0
Via: SIP/2.0/UDP ${myProxy}:${regPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
To: <sip:${username}@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=${tag}
Call-ID: ${callId}
CSeq: ${cseq++} REGISTER
Contact: <sip:${username}@${myIp}:${regPort}>
Expires: 3600
User-Agent: CustomSipClient
${authorizationHeader}
Content-Length: 0
`.trim();
sendSIPMessage(authenticatedRegisterMessage);

}
// =================================================

// Function to send a SIP message
function sendSIPMessage(message) {
  const buffer = Buffer.from(message);
  socket.send(message, 0, buffer.length, sipServerPort, sipServer, (err) => {
    if (err) {
      console.error('Failed to send SIP message:', err);
    } else {
      console.log('SIP message sent:\n', message);
    }
  });
}

// Function to generate a SIP REGISTER message
function createRegisterMessage(regPort) {
  return `REGISTER sip:${realm};transport=UDP SIP/2.0
Via: SIP/2.0/UDP ${myProxy}:${regPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')};rport
Max-Forwards: 70
To: <${contactUri};transport=UDP>
From: <${contactUri}>;tag=${tag}
Call-ID: ${callId}
CSeq: ${cseq} REGISTER
Contact: <${contactUri}:${regPort};transport=UDP;rinstance=d7481615a989872e>
Expires: 60
Allow: INVITE, ACK, CANCE
Supported: replaces, norefersub, extended-refer, timer, sec-agree, outbound, path, X-cisco-serviceuri
Allow-Events: presence, kpml, talk, as-feature-event
User-Agent: CustomSipClient
Content-Length: 0`;
}

// Function to generate a SIP INVITE message
function createInviteMessage(rtpPort, regPort) {
  var hreturn =`INVITE ${target} SIP/2.0
Via: SIP/2.0/UDP ${myProxy}:${regPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
To: ${target}
From: ${localUri};tag=${tag}
Call-ID: ${callId}
CSeq: 123 INVITE
Contact: <sip:${username}@${myIp}:${regPort};transport=UDP>
Allow: INVITE, ACK, CANCEL, BYE, NOTIFY, REFER, MESSAGE, OPTIONS, INF
Content-Type: application/sdp
Supported: replaces, norefersub, extended-refer, timer, sec-agree, outbound, path, X-cisco-serviceuri
Allow-Events: presence, kpml, talk, as-feature-event
User-Agent: CustomSipClient
Content-Length: 342

v=0
o=Z 0 32573386 IN IP4 ${myIp}
s=Custom SIP Call
c=IN IP4 ${myIp}
t=0 0
m=audio  ${rtpPort} RTP/AVP 106 9 98 101 0 8 3
a=rtpmap:106 opus/48000/2
a=fmtp:106 sprop-maxcapturerate=16000; minptime=20; useinbandfec=1
a=rtpmap:98 telephone-event/48000
a=fmtp:98 0-16
a=sendrecv
a=rtcp-mux
a=rtpma
`;



return `INVITE sip:18722990045@${sipServer};transport=UDP SIP/2.0
Via: SIP/2.0/UDP ${myProxy}:${regPort};branch=z9hG4bK-524287-1---fd9e87789e292257;rport
Max-Forwards: 70
Contact: <sip:tribe-demo@${myIp}:${regPort};transport=UDP>
To: <sip:18722990045@${sipServer}>
From: <sip:tribe-demo@${sipServer};transport=UDP>;tag=9b2c7a2d
Call-ID: ${callId}
CSeq: 123 INVITE
Allow: INVITE, ACK, CANCEL, BYE, NOTIFY, REFER, MESSAGE, OPTIONS, INF
Content-Type: application/sdp
Supported: replaces, norefersub, extended-refer, timer, sec-agree, outbound, path, X-cisco-serviceuri
User-Agent: CustomSipClient
Allow-Events: presence, kpml, talk, as-feature-event
Content-Length: 342

v=0
o=Z 0 32573386 IN IP4 ${myIp}
s=Custom SIP Call
c=IN IP4 ${myIp}
t=0 0
m=audio ${rtpPort} RTP/AVP 106 9 98 101 0 8 3
a=rtpmap:106 opus/48000/2
a=fmtp:106 sprop-maxcapturerate=16000; minptime=20; useinbandfec=1
a=rtpmap:98 telephone-event/48000
a=fmtp:98 0-16
a=sendrecv
a=rtcp-mux
a=rtpma`
}
function createInvite200Message(CSeq,callId, regPort) {

  return `SIP/2.0 200 OK
Via: SIP/2.0/UDP ${sipServer}:5060;branch=z9hG4bK-524287-1---fd9e87789e292257;rport=5060
Max-Forwards: 70
Contact: <sip:tribe-demo@${myIp}:${regPort};transport=UDP>
From: <sip:18722990045@${sipServer};transport=UDP>
To: <sip:tribe-demo@${sipServer}>;tag=9b2c7a2d
Call-ID: ${callId}
CSeq: ${CSeq} INVITE
Allow: INVITE, ACK, CANCEL, BYE, NOTIFY, REFER, MESSAGE, OPTIONS, INF
Content-Type: application/sdp
Supported: replaces, norefersub, extended-refer, timer, sec-agree, outbound, path, X-cisco-serviceuri
User-Agent: CustomSipClient
Allow-Events: presence, kpml, talk, as-feature-event
Content-Length: 342

v=0
o=Z 0 32573386 IN IP4 ${myIp}
s=Z
c=IN IP4 ${myIp}
t=0 0
m=audio 64582 RTP/AVP 106 9 98 101 0 8 3
a=rtpmap:106 opus/48000/2
a=fmtp:106 sprop-maxcapturerate=16000; minptime=20; useinbandfec=1
a=rtpmap:98 telephone-event/48000
a=fmtp:98 0-16
a=rtpma`.trim()
  }
function getACK(cseq, callId, regPort) {
    return `ACK sip:${destination}@${sipServer}:5060 SIP/2.0
Via: SIP/2.0/UDP ${myProxy};branch=z9hG4bK776asdhds;RPort: rport
Max-Forwards: 70
From: <sip:${username}@${sipServer}>;tag=456248
To: <sip:${destination}@${sipServer}>;tag=abcd1234
Call-ID: ${callId}
CSeq: ${cseq} ACK
Contact: <sip:${username}@${myIp}:${regPort};transport=UDP>
User-Agent: CustomSipClient
Content-Length: 0`.trim();
}
rl.question('Press Enter to exit...\n', () => {
  socket.close();
  rl.close();
});
