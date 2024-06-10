const Mic = require('node-microphone');
const Speaker = require('speaker');
const { spawn } = require('child_process');

// Initialize microphone
const mic = new Mic();
const micStream = mic.startRecording();

// Initialize speaker
const speaker = new Speaker({
  channels: 1, // Mono channel
  bitDepth: 16, // 16-bit samples
  sampleRate: 8000 // 16,000 Hz sample rate
});

// SoX command for real-time audio processing
const soxProcess = spawn('sox', [
  '-t', 'raw', // input type
  '-r', '8000', // input sample rate
  '-e', 'signed-integer', // input encoding
  '-b', '16', // input bit depth
  '-c', '1', // input channels
  '-', // read from stdin
  '-t', 'raw', // output type
  '-r', '8000', // output sample rate
  '-e', 'signed-integer', // output encoding
  '-b', '16', // output bit depth
  '-c', '1', // output channels
  '-', // write to stdout
  'gain', '-n', '3' // apply gain effect
]);

// Pipe the microphone stream to SoX process stdin
micStream.pipe(soxProcess.stdin);

// Pipe SoX process stdout to the speaker
soxProcess.stdout.pipe(speaker);

soxProcess.on('error', (err) => {
  console.error('An error occurred:', err.message);
});

soxProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`SoX process exited with code ${code}`);
  } else {
    console.log('Audio processing finished');
  }
});

// Stop recording and processing after a specified time
setTimeout(() => {
  console.info('Stopped recording');
  mic.stopRecording();
  soxProcess.stdin.end(); // End the SoX stdin stream
}, 5000); // Record for 5 seconds

mic.on('info', (info) => {
  console.log(info);
});

mic.on('error', (error) => {
  console.log(error);
});
