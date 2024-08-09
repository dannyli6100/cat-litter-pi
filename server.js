console.log(require("dotenv").config({ debug: true }));
const express = require("express"); // web server
const http = require("http"); // server instance
const socketIo = require("socket.io"); // real-time communication
const wrtc = require("wrtc"); // webrtc library
const Stream = require("node-rtsp-stream");

const app = express(); // create express app
const server = http.createServer(app); // create http server
const io = socketIo(server); // attach socket.io to server

const peerConnections = new Map(); // map of peer connections, keyed with socket ids

const piIP = process.env.RASPBERRY_PI_IP;
const port = process.env.PORT;

const stream = new Stream({
  name: "stream",
  streamUrl: "rtsp://",
});

// listen for socket.io connections
io.on("connection", (socket) => {
  console.log("a user connected");

  let peerConnection; // declare peer connection variable so it's available to all event handlers in connection

  socket.on("join", async (roomId) => {
    // join event handler
    socket.join(roomId);
    console.log("user joined room " + roomId);

    peerConnection = new wrtc.RTCPeerConnection({
      // on user join, create peer connection
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peerConnections.set(socket.id, peerConnection);

    // video track from raspberry pi need to look it up

    // ice candidate event handler
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
    } catch (err) {
      console.log(err);
    }
    socket.emit("offer", offer);
  });

  // answer event handler
  socket.on("answer", async (answer) => {
    try {
      await peerConnection.setRemoteDescription(answer);
    } catch (err) {
      console.log(err);
    }
  });

  // ice candidate event handler
  socket.on("ice-candidate", async (candidate) => {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (err) {
      console.log(err);
    }
  });

  // disconnect event handler
  socket.on("disconnect", () => {
    console.log("a user disconnected");
    if (peerConnection) {
      peerConnection.close();
      peerConnections.delete(socket.id);
    }
  });
});

// start server and listen on port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
