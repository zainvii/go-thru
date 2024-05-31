const dgram = require('dgram');
const sip = require('sip');

// Configure SIP and RTP
const localIp = '127.0.0.1';
const localSipPort = 5060;
const localRtpPort = 10000; // Local RTP port for receiving
const remoteRtpPort = 10002; // This will be updated upon receiving 200 OK

// Create RTP socket
const rtpSocket = dgram.createSocket('udp4');

// Handle incoming RTP packets
rtpSocket.on('message', (msg, rinfo) => {
  console.log(`Received RTP packet from ${rinfo.address}:${rinfo.port}`);
  // Handle RTP payload (e.g., decode audio)
});

// Bind RTP socket
rtpSocket.bind(localRtpPort, localIp, () => {
  console.log(`RTP socket listening on ${localIp}:${localRtpPort}`);
});

// Function to send SIP INVITE
function sendInvite() {
  const invite = {
    method: 'INVITE',
    uri: `sip:remote-user@${localIp}`,
    headers: {
      to: { uri: `sip:remote-user@${localIp}` },
      from: { uri: `sip:local-user@${localIp}`, params: { tag: 'local-tag' } },
      'call-id': 'unique-call-id',
      cseq: { method: 'INVITE', seq: Math.floor(Math.random() * 1e5) },
      contact: [{ uri: `sip:local-user@${localIp}` }],
      'content-type': 'application/sdp'
    },
    content: [
      'v=0',
      `o=- 12345 67890 IN IP4 ${localIp}`,
      's=-',
      `c=IN IP4 ${localIp}`,
      't=0 0',
      `m=audio ${localRtpPort} RTP/AVP 0`,
      'a=rtpmap:0 PCMU/8000'
    ].join('\r\n')
  };

  sip.send(invite, (response) => {
    if (response.status === 200) {
      console.log('Received 200 OK');
      const sdp = response.content;
      // Parse SDP to get remote RTP port
      const remoteRtpPortMatch = sdp.match(/m=audio (\d+) RTP\/AVP/);
      if (remoteRtpPortMatch) {
        const remoteRtpPort = parseInt(remoteRtpPortMatch[1], 10);
        console.log(`Remote RTP port: ${remoteRtpPort}`);
        // Now send RTP packets to the remote port
        sendRtpPackets(remoteRtpPort);
      }
    } else {
      console.log(`Received SIP response: ${response.status}`);
    }
  });
}

// Function to send RTP packets
function sendRtpPackets(remoteRtpPort) {
  const message = Buffer.from('Your RTP payload data');
  setInterval(() => {
    rtpSocket.send(message, 0, message.length, remoteRtpPort, localIp, (err) => {
      if (err) console.error('Error sending RTP packet:', err);
    });
  }, 1000 / 50); // Example: send 50 RTP packets per second
}

// Start by sending the SIP INVITE
sendInvite();
