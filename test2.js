const dgram = require('dgram');
const crypto = require('crypto');
const fs = require('fs');
const Speaker = require('speaker');
const wav = require('wav');
const socket = dgram.createSocket('udp4');

const username = 'tribe-demo';
const password = 'asd32EASdYKfL';  // Replace with your actual password
const realm = '34.67.132.35';  // Replace with the actual realm from the 401 response
const sipServer = '34.67.132.35';
const sipServerPort = 5060;

// Initial REGISTER message
const registerMessage = `
REGISTER sip:${sipServer} SIP/2.0
Via: SIP/2.0/UDP 3.217.136.195:53646;branch=z9hG4bK776asdhds
Max-Forwards: 70
To: <sip:${username}@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=1928301774
Call-ID: a84b4c76e66710
CSeq: 1 REGISTER
Contact: <sip:${username}@${sipServer}>
Expires: 60
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, NOTIFY, MESSAGE, SUBSCRIBE, INFO
User-Agent: Z 5.6.4 v2.10.20.4
Content-Length: 0
`.trim();

socket.send(registerMessage, sipServerPort, sipServer, (err) => {
    if (err) {
        console.error('Error sending SIP REGISTER message:', err);
        socket.close();
    } else {
        console.log('SIP REGISTER message sent successfully.');
    }
});

let rtpListening = false
// Handle Responses
socket.on('message', (msg, rinfo) => {
    const response = msg.toString();
    console.log(`Received message from ${rinfo.address}:${rinfo.port}`);
    console.log(response);

     
    if (response.includes('401 Unauthorized')) {
        const authenticateHeader = parseWWWAuthenticate(response);
        const authorizationHeader = generateAuthorizationHeader(authenticateHeader);
        sendAuthenticatedRegister(authorizationHeader);
    } else if (response.includes('200 OK') && response.includes('REGISTER')) {
        console.log("sip registered successfully");
        initiateCall();
    } else if (response.includes('200 OK') && response.includes('INVITE')) {
        console.log('Call initiated successfully. Waiting for RTP packets...');
        if (!rtpListening) {
            // Start listening for RTP packets
            startRTPListening();
            rtpListening = true;
          }
    } else if (response.includes('500 Server error')) {
        console.log('<=================================================>')
        console.error('Received 500 Server Error for INVITE request. \n',response);
        console.log('<=================================================>')

  
            // const retryAfterMatch = response.match(/Retry-After:\s*(\d+)/i);
            // const retryAfterSeconds = retryAfterMatch ? parseInt(retryAfterMatch[1]) : 0;
            // console.error('Received 500 Server Error for INVITE request. Retrying after ' + retryAfterSeconds + ' seconds.');
            // setTimeout(initiateCall, retryAfterSeconds * 1000); // Retry after suggested duration
        
    } else if (response.includes('OPTIONS')) {
        handleOptions(response, rinfo);
    }
    
});
// initiateCall()
// Handle OPTIONS requests
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
Via: SIP/2.0/UDP 3.217.136.195:53646;branch=z9hG4bK776asdhds
Max-Forwards: 70
To: <sip:${username}@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=1928301774
Call-ID: a84b4c76e66710
CSeq: 2 REGISTER
Contact: <sip:${username}@${sipServer}>
Expires: 3600
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, NOTIFY, MESSAGE, SUBSCRIBE, INFO
User-Agent: Z 5.6.4 v2.10.20.4
${authorizationHeader}
Content-Length: 0
`.trim();

    socket.send(authenticatedRegisterMessage, sipServerPort, sipServer, (err) => {
        if (err) {
            console.error('Error sending authenticated SIP REGISTER message:', err);
            socket.close();
        } else {
            console.log('Authenticated SIP REGISTER message sent successfully.');
        }
    });
}

// Initiate Call
function initiateCallcc() {

    const inviteMessagess = `
    INVITE sip:18722990045@34.67.132.35;transport=UDP SIP/2.0
    Via: SIP/2.0/UDP 3.217.136.195:53646;branch=z9hG4bK776asdhds
    Max-Forwards: 70
    Contact: <sip:tribe-demo@3.217.136.195:52140;transport=UDP>
    To: <sip:18722990045@34.67.132.35>
    From: <sip:tribe-demo@34.67.132.35;transport=UDP>;tag=b472d522
    Call-ID: a84b4c76e66710
    CSeq: 1 INVITE
    Allow: INVITE, ACK, CANCEL, BYE, NOTIFY, REFER, MESSAGE, OPTIONS, INFO, SUBSCRIBE
    Content-Type: application/sdp
    Supported: replaces, norefersub, extended-refer, timer, sec-agree, outbound, path, X-cisco-serviceuri
    User-Agent: Z 5.6.4 v2.10.20.4
    Allow-Events: presence, kpml, talk, as-feature-event
    Content-Length: 342
    v=0
    o=Z 0 95216731 IN IP4 3.217.136.195
    s=Z
    c=IN IP4 3.217.136.195
    t=0 0
    m=audio 59979 RTP/AVP 106 9 98 101 0 8 3
    a=rtpmap:106 opus/48000/2
    a=fmtp:106 sprop-maxcapturerate=16000; minptime=20; useinbandfec=1
    a=rtpmap:98 telephone-event/48000
    a=fmtp:98 0-16
    a=rtpmap:101 telephone-event/8000
    a=fmtp:101 0-16
    a=sendrecv
    a=rtcp-mux`;
    const sdps = `
v=0
o=${username} 2890844526 2890844526 IN IP4 3.217.136.195
s=
c=IN IP4 3.217.136.195
t=0 0
m=audio 49170 RTP/AVP 0
a=rtpmap:0 PCMU/8000
`.trim();

const sdp = `
v=0
o=root 2890844526 2890844526 IN IP4 192.168.1.100
s=Asterisk PBX 1.8.32.3
c=IN IP4 192.168.1.100
t=0 0
m=audio 12345 RTP/AVP 0 8 101
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16`;

    const inviteMessages = `
INVITE sip:18722990045@${sipServer};transport=UDP SIP/2.0
Via: SIP/2.0/UDP 3.217.136.195:53647;branch=z9hG4bK776asdhds
Max-Forwards: 70
To: <sip:18722990045@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=1928301774
Call-ID: a84b4c76e66710
CSeq: 1 INVITE
Contact: <sip:${username}@${sipServer}>
Content-Type: application/sdp
Content-Length: ${sdp.length}
Expires: 60
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, NOTIFY, MESSAGE, SUBSCRIBE, INFO
User-Agent: Z 5.6.4 v2.10.20.4
${sdp}
`.trim();

const inviteMessagsse = `
INVITE sip:${username}@${sipServer} SIP/2.0
Via: SIP/2.0/UDP 3.217.136.195:5060;branch=z9hG4bK776asdhds
Max-Forwards: 70
To: <sip:18722990045@${sipServer}>
From: <sip:${username}@${sipServer}>;tag=1928301774
Call-ID: a84b4c76e66710
CSeq: 1 INVITE
Contact: <sip:18722990045@${sipServer}>
Content-Type: application/sdp
Content-Length: 0
${sdp}
`.trim();;


const inviteMessage = `INVITE sip:18722990045@${sipServer} SIP/2.0
Via: SIP/2.0/UDP ${sipServer}:${sipServerPort};branch=z9hG4bK776asdhds
From: <sip:${username}@${realm}>;tag=1928301774
To: <sip:18722990045@${sipServer}>
Call-ID: a84b4c76e66710@pc33.atlanta.com
CSeq: 314159 INVITE
Contact: <sip:${username}@${realm}>
Content-Type: application/sdp

v=0
o=- 0 0 IN IP4 127.0.0.1
s=session
c=IN IP4 127.0.0.1
t=0 0
m=audio 49172 RTP/AVP 0`;
    socket.send(inviteMessage, sipServerPort, sipServer, (err) => {
        if (err) {
            console.error('Error sending SIP INVITE message:', err);
            socket.close();
        } else {
            console.log('SIP INVITE message sent successfully.\n', inviteMessage);
        }
    });
}
function initiateCall() {
    const inviteMessage = `
INVITE sip:18722990045@${sipServer} SIP/2.0
Via: SIP/2.0/UDP 3.217.136.195:53646;branch=z9hG4bK776asdhds;received=3.217.136.195;rport=57427
From: <sip:tribe-demo@34.67.132.35>;tag=1928301774
To: <sip:18722990045@34.67.132.35>;tag=as7cf085ef
Call-ID: a84b4c76e66710
CSeq: 1 INVITE
Server: Asterisk PBX 1.8.32.3
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, SUBSCRIBE, NOTIFY, INFO, PUBLISH, MESSAGE     
Supported: replaces, timer
Retry-After: 8
Content-Length: 0
`.trim();

    socket.send(Buffer.from(inviteMessage), sipServerPort, sipServer, (err) => {
        if (err) {
            console.error('Error sending SIP INVITE message:', err);
            socket.close();
        } else {
            console.log('SIP INVITE message sent successfully.');
        }
    });
}
// Listen for RTP Packets
function startRTPListening() {
    const rtpPort = 5004; // Example RTP port, make sure to match your SDP
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

    rtpSocket.bind(rtpPort, () => {
        console.log(`RTP listening on port ${rtpPort}`);
    });

    rtpSocket.on('error', (err) => {
        console.error(`RTP socket error: ${err}`);
        rtpSocket.close();
    });
}

socket.on('error', (err) => {
    console.error(`Socket error: ${err}`);
    socket.close();
});
