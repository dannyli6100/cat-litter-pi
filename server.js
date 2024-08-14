console.log(require("dotenv").config({ debug: true }));
const express = require("express"); // web server
const http = require("http"); // server instance
const socketIo = require("socket.io"); // real-time communication
const NodeMediaServer = require("node-media-server");
const { StreamCamera, Codec } = require("pi-camera-connect");
const fs = require("fs");

const app = express(); // create express app
const server = http.createServer(app); // create http server
const io = socketIo(server); // attach socket.io to server

const piIP = process.env.RASPBERRY_PI_IP;
const port = process.env.PORT;

const config = {
  rtmp: {
    port: 1935, // standard rtmp port, The ffmpeg process streams video to this port,
    // and RTMP clients can connect to this port to receive the stream.
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000, // standard http port
    allow_origin: "*",
  },
};

// create new instance of node-media-server
var nms = new NodeMediaServer(config);
// run trmp server
nms.run();

const streamCamera = new StreamCamera({
  codec: Codec.H264,
});

const startStreaming = async () => {
  const videoStream = streamCamera.createStream();

  const streamToRTMP = fs.createWriteStream(`rtmp://${piIP}:1935/live/stream`);

  videoStream.pipe(streamToRTMP);

  await streamCamera.startCapture();

  console.log("streaming started");
};

startStreaming().catch((err) => console.error(err));

// listen for socket.io connections
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join", async (roomId) => {
    // join event handler
    socket.join(roomId);
    console.log("user joined room " + roomId);
    // send stream ready url to client
    socket.emit("stream-ready", `rtmp://${piIP}:1935/live/stream`);
  });

  // disconnect event handler
  socket.on("disconnect", () => {
    console.log("a user disconnected");
  });
});

process.on("SIGINT", async () => {
  await streamCamera.stopCapture();
  process.exit();
});

// start server and listen on port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
