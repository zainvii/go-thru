require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const JsSIP = require('jssip');
const NodeWebSocket = require('jssip-node-websocket');
const {service} = require('./udpService')
// ======================================
const ip = process.env.SIP_IP;
const password = process.env.SIP_PASSWORD;
const peer = process.env.SIP_PEER;
const target = process.env.SIP_TARGET;
const port = process.env.SIP_PORT;
// ======================================

const sipConfig = {
    uri: `sip:${peer}@${ip}:${port}`,
    password: password,
    realm: `${ip}`, 
    server: `${ip}:${port}`
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
// ========================================

  // Initialize Express
  const app = express();

  const options = {
    key: fs.readFileSync(path.join(__dirname, process.env.SSL_KEY_PATH)),
    cert: fs.readFileSync(path.join(__dirname, process.env.SSL_CERT_PATH)),
  };
  
  const server = https.createServer(options, app);

  app.get('/speaker-check', (req, res) => {
    try {
        //  service.createStream();
    } catch (error) {
        console.error('Error initiating SIP call:', error);
        res.status(500).send('Internal Server Error');
    }
  });

  app.get('/initiate-sip', (req, res) => {
    try {
        // return service.initateSip(userAgent)
    } catch (error) {
        console.error('Error initiating SIP call:', error);
        res.status(500).send('Internal Server Error');
    }
  });

  app.get('/initiate-call', (req, res) => {
    try {
        // const input = {
        //     target,
        //     ip,
        //     port 
        // }
        // return service.initiateCall(userAgent,input, res)
        service.initateConn();
    } catch (error) {
        console.error('Error initiating SIP call:', error);
        res.status(500).send('Internal Server Error');
    }
  });

  // Start the Express server
  const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});