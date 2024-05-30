const dgram = require('dgram');
const crypto = require('crypto');

// SIP account details
const username = 'tribe-demo';
const password = 'asd32EASdYKfL';
const realm = '34.67.132.35';
const sipServer = '34.67.132.35';
const myIp = '3.217.139.195';
const myProxy = '10.8.0.15';
const sipServerPort = 5060;

// Create a UDP socket
const socket = dgram.createSocket('udp4');

// Generate a unique Call-ID
const callId = crypto.randomBytes(16).toString('hex');

// Generate a unique CSeq number
const cseq = Math.floor(Math.random() * 10000);

// Construct the SIP REGISTER message
const registerMessage = `
REGISTER sip:${realm} SIP/2.0
Via: SIP/2.0/UDP ${myIp};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
From: <sip:${username}@${realm}>;tag=${crypto.randomBytes(8).toString('hex')}
To: <sip:${username}@${realm}>
Call-ID: ${callId}
CSeq: ${cseq} REGISTER
Contact: <sip:${username}@${myIp}>
Expires: 3600
User-Agent: MySIPClient/1.0
Content-Length: 0

`.trim();

// Function to send a message
function sendMessage(message, port, address) {
    socket.send(Buffer.from(message), port,  (err) => {
        if (err) {
            console.error('Error sending message:', err);
        } else {
            console.log('Message sent');
        }
    });
}

// Handle incoming messages
socket.on('message', (msg, rinfo) => {
    const response = msg.toString();
    console.log('Received response:', response);
    
    if (response.includes('401 Unauthorized')) {
        // Extract the nonce from the 401 response
        const nonce = response.match(/nonce="([^"]+)"/)[1];
        
        // Generate a response using the nonce
        const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`REGISTER:sip:${realm}`).digest('hex');
        const responseHash = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        
        // Construct the REGISTER message with authentication
        const authRegisterMessage = `
REGISTER sip:${realm} SIP/2.0
Via: SIP/2.0/UDP ${myIp};branch=z9hG4bK${crypto.randomBytes(8).toString('hex')}
Max-Forwards: 70
From: <sip:${username}@${realm}>;tag=${crypto.randomBytes(8).toString('hex')}
To: <sip:${username}@${realm}>
Call-ID: ${callId}
CSeq: ${cseq + 1} REGISTER
Contact: <sip:${username}@${myIp}>
Expires: 3600
User-Agent: MySIPClient/1.0
Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="sip:${realm}", response="${responseHash}", algorithm=MD5
Content-Length: 0

`.trim();

        // Send the authenticated REGISTER message
        sendMessage(authRegisterMessage, sipServerPort, myProxy);
    }
});

// Bind the socket to a local port
socket.bind(() => {
    console.log(`Socket bound to port ${socket.address().port}`);
    
    // Send the initial REGISTER message
    sendMessage(registerMessage, sipServerPort, myProxy);
});
