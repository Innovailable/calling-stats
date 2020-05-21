const express = require('express')
const { CallingWebsocketServer, get_cli_options } = require('calling-signaling');
const { SignalingStatistics } = require('./stats');

const signaling = new CallingWebsocketServer(get_cli_options());
const statistics = new SignalingStatistics(signaling);

const app = express()
const signalingPort = Number(process.env.SIGNALING_PORT || 8010)
const metricsPort = Number(process.env.METRICS_PORT || 8020)

statistics.addMetricsRoute(app);

Promise.all([
  signaling.listen(signalingPort),
  new Promise((resolve, reject) => {
    app.listen(metricsPort, (err) => {
      if(err) {
        reject(err)
      } else {
        resolve();
      }
    });
  }),
]).then(() => {
  console.log("Signaling server started");
});

