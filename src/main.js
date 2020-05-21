const express = require('express')
const { CallingWebsocketServer } = require('calling-signaling');
const { trackSignaling, addMetricsRoute } = require('./stats');

const app = express()
const signaling = new CallingWebsocketServer(0);

const signalingPort = Number(process.env.SIGNALING_PORT || 8010)
const metricsPort = Number(process.env.METRICS_PORT || 8020)

trackSignaling(signaling);
addMetricsRoute(app);

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

