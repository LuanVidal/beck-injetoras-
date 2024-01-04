const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const puppeteer = require("puppeteer-core");
const ScreenManager = require("./screen-manager");

app.use(express.static("dist"));

io.on("connection", (socket) => {
  console.log("Servidor conectado");

  socket.on("disconnect", () => {
    console.log("Servidor desconectado");
  });

  const screenManager = new ScreenManager(io);

  // Listen for key events
  socket.on("keyboard-listener", (key) => {
    // Forward the key to the screen manager
    screenManager.handleKey(key);
  });

  // Start the measurement loop
  startMeasurementLoop();

  // Change screen on connection
  screenManager.changeScreenTo("matricula");
});

const port = process.env.PORT || 8080;
http.listen(port, async () => {
  console.log(`Servidor Node.js rodando em http://localhost:${port}`);
});