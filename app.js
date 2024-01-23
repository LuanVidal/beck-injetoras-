const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const puppeteer = require("puppeteer-core");
const ScreenManager = require("./screen-manager");
const { startMeasurementLoop, data } = require("./sensor");

app.use(express.static("dist"));

io.on("connection", (socket) => {
  console.log("Servidor conectado");

  socket.on("disconnect", () => {
    console.log("Servidor desconectado");
  });

  const screenManager = new ScreenManager(io, data);

  // Escuta eventos de tecla
  socket.on("keyboard-listener", (key) => {
    // Repassa o caractere para o gerenciador de tela
    screenManager.handleKey(key);
  });

  // Inicia a medição
  startMeasurementLoop();
});

const port = process.env.PORT || 3000;
http.listen(port, async () => {
  console.log(`Servidor Node.js rodando em http://localhost:${port}`);

  // Abre o Chromium em tela cheia
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: false,
    args: ['--start-fullscreen',
    '--disable-gpu',
    '--disable-infobars',
    '--start-maximized',
    '--app=http://localhost:3000/',
    '--user-data-dir=/tmp/puppeteer_user_data',],

    ignoreDefaultArgs: ['--enable-automation'],
  });

});
