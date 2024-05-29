const dgram = require('dgram');
const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const Speaker = require('speaker');
const wav = require('wav');

const username = 'tribe-demo';
const password = 'asd32EASdYKfL';
const realm = '34.67.132.35';
const sipServer = '34.67.132.35';
const sipServerPort = 5060;
const target = 'sip:18722990045@34.67.132.35';
const destination = '18722990045';
// Create a UDP socket
const socket = dgram.createSocket('udp4');

// Generate a random Call-ID and CSeq
const callId = crypto.randomBytes(16).toString('hex');
let cseq = 1;

// Generate a unique tag
const tag = crypto.randomBytes(8).toString('hex');

// Define the local SIP URI
const localUri = `sip:${username}@${realm}`;

// Define the contact URI
const contactUri = `sip:${username}@${sipServer}`;

// Function to send a SIP message
function sendSIPMessage(message) {
  const buffer = Buffer.from(message);
  socket.send(buffer, 0, buffer.length, sipServerPort, sipServer, (err) => {
    if (err) {
      console.error('Failed to send SIP message:', err);
    } else {
      console.log('SIP message sent:\n', message);
    }
  });
}

// Function to generate a SIP REGISTER message
function createRegisterMessage() {
  return `REGISTER sip:${realm} SIP/2.0
Via: SIP/2.0/UDP ${username}:${sipServerPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
To: ${localUri}
From: ${localUri};tag=${tag}
Call-ID: ${callId}
CSeq: ${cseq++} REGISTER
Contact: ${contactUri}
Expires: 3600
User-Agent: CustomSipClient/1.0
Content-Length: 0

`;
}
dynamicallyAssignedRtpPort=0
// Function to generate a SIP INVITE message
function createInviteMessage(rtpPort) {
  return `INVITE ${target} SIP/2.0
Via: SIP/2.0/UDP ${username}:${sipServerPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
To: ${target}
From: ${localUri};tag=${tag}
Call-ID: ${callId}
CSeq: 123 INVITE
Contact: ${contactUri}
Content-Type: application/sdp
User-Agent: CustomSipClient/1.0
Content-Length: 0

v=0
o=- 0 0 IN IP4 ${sipServer}
s=Custom SIP Call
c=IN IP4 ${sipServer}
t=0 0
m=audio ${rtpPort} RTP/AVP 0
a=rtpmap:0 PCMU/8000
`;
}

// Listen for incoming messages from the SIP server
socket.on('message', (message, rinfo) => {
  console.log('Received message:\n', message.toString());
  const response = message.toString();
  if (response.includes('401 Unauthorized')) {
    const authenticateHeader = parseWWWAuthenticate(response);
    const authorizationHeader = generateAuthorizationHeader(authenticateHeader);
    sendAuthenticatedRegister(authorizationHeader);
  } else if (response.includes('200 OK') && response.includes('REGISTER')) {
    // Registration successful, initiate the call
    sendSIPMessage(createInviteMessage(dynamicallyAssignedRtpPort));
  } else if (response.includes('100 Trying')) {
    // Handling 100 Trying: simply log it and wait for further responses
    console.log('Call is trying...');
  } else if (response.includes('180 Ringing')) {
    // Handling 180 Ringing: log it
    console.log('Call is ringing...');
  } else if (response.includes('200 OK') && response.includes('INVITE')) {
    console.log('Call initiated successfully. Waiting for RTP packets...');

const callIdMatch = response.match(/Call-ID: (.*)/);
  const cseqMatch = response.match(/CSeq: (\d+) INVITE/);
  const callId = callIdMatch ? callIdMatch[1] : '';
  const cseq = cseqMatch ? cseqMatch[1] : '';

const ackMessage = `ACK sip:${destination}@${sipServer} SIP/2.0
Via: SIP/2.0/UDP ${sipServer};branch=z9hG4bK776asdhds
Max-Forwards: 70
From: "${username}" <sip:${username}@${sipServer}>;tag=456248
To: "${destination}" <sip:${destination}@${sipServer}>;tag=abcd1234
Call-ID: ${callId}
CSeq: ${cseq} ACK
Contact: <sip:${username}@${sipServer}>
Content-Length: 0
`;
    sendSIPMessage(ackMessage);
    console.log('Call established.');
    startRTPListening();
  } else if (response.includes('BYE')) {
    // Handle BYE: send OK
    const byeOkMessage = `SIP/2.0 200 OK
Via: ${response.match(/Via: (.*)/)[1]}
To: ${response.match(/To: (.*)/)[1]}
From: ${response.match(/From: (.*)/)[1]}
Call-ID: ${response.match(/Call-ID: (.*)/)[1]}
CSeq: ${response.match(/CSeq: (.*)/)[1]}
User-Agent: CustomSipClient/1.0
Content-Length: 0

`;
    sendSIPMessage(byeOkMessage);
    console.log('Call ended.');
  } else if (response.includes('OPTIONS')) {
    handleOptions(response, rinfo);
  }
});

// Function to handle SIP OPTIONS
function handleOptions(response, rinfo) {
  const callIdMatch = response.match(/Call-ID: (.*)/);
  const cseqMatch = response.match(/CSeq: (\d+) OPTIONS/);
  const callId = callIdMatch ? callIdMatch[1] : '';
  const cseq = cseqMatch ? cseqMatch[1] : '';

  const optionsResponse = `
SIP/2.0 200 OK
Via: SIP/2.0/UDP ${rinfo.address}:${rinfo.port};received=${rinfo.address};branch=z9hG4bK776asdhds;rport=${rinfo.port}
To: <sip:${username}@${sipServer}>;tag=as73a67a1f
From: "asterisk" <sip:asterisk@${sipServer}>;tag=as73a67a1f
Call-ID: ${callId}
CSeq: ${cseq} OPTIONS
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, SUBSCRIBE, NOTIFY, INFO, PUBLISH, MESSAGE
Supported: replaces, timer
User-Agent: Custom SIP Client
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
function startRTPListening() {
  const rtpSocket = dgram.createSocket('udp4');

  const wavReader = new wav.Reader();
  const speaker = new Speaker();

  wavReader.on('format', (format) => {
    wavReader.pipe(speaker);
  });

  rtpSocket.on('message', (msg) => {
    console.log('Received RTP packet');
    wavReader.write(msg);
  });

  rtpSocket.bind(0, () => { // Bind to port 0 to dynamically assign a port
    const dynamicallyAssignedRtpPort = rtpSocket.address().port;
    console.log(`RTP listening on port ${dynamicallyAssignedRtpPort}`);
    
    // Send the initial REGISTER message after getting the RTP port
   
  });
 
  rtpSocket.on('error', (err) => {
    console.error(`RTP socket error: ${err}`);
    rtpSocket.close();
  });
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
function sendAuthenticatedRegister(authorizationHeader) {
  const authenticatedRegisterMessage = `
REGISTER sip:${sipServer} SIP/2.0
Via: SIP/2.0/UDP ${username}:${sipServerPort};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
To: <sip:${username}@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=${tag}
Call-ID: ${callId}
CSeq: ${cseq++} REGISTER
Contact: <sip:${username}@${sipServer}>
Expires: 3600
User-Agent: CustomSipClient/1.0
${authorizationHeader}
Content-Length: 0
`.trim();
  sendSIPMessage(authenticatedRegisterMessage);
}

// Start listening for RTP packets and send REGISTER message
startRTPListening();

// Keep the program running
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
sendSIPMessage(createRegisterMessage());
rl.question('Press Enter to exit...\n', () => {
  socket.close();
  rl.close();
});
