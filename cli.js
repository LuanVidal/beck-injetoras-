const readline = require('readline');
const { connect } = require('socket.io-client');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Conecte-se ao servidor Socket.io
const io = connect('http://localhost:3000'); // Substitua com a URL do seu servidor se necessário

// Função para enviar mensagens para o servidor
function sendMessage(socketEvent) {
  rl.question('Digite a mensagem: ', (msg) => {
    io.emit(socketEvent, msg);
    console.log(`Mensagem ${socketEvent} enviada: ${msg}`);
    rl.close();
  });
}

// Escolha o evento de socket apropriado e chame a função sendMessage
rl.question('Escolha o evento de socket (ex: create-something, message, etc.): ', (socketEvent) => {
  if (typeof io.on === 'function') {
    sendMessage(socketEvent);
  } else {
    console.log('Erro na conexão com o servidor Socket.io. Encerrando.');
    rl.close();
  }
});

io.on('connect', () => {
  console.log('Conectado ao servidor Socket.io');
});