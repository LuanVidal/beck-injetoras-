const SerialPort = require('serialport');
const amqp = require('amqplib');
const ping = require('ping');

const amqpServerUrl = 'amqp://W4nuCL2HK09PrG8H:7NXYX2gGYHGxCIBKoN3UtsLfRh@trends.injetoras.tcsapp.com.br:5672';
const amqpQueue = 'measurements';

const FILTRO = 0.03;
const LIMIAR_TENSAO = 28000;
const LIMIAR_CORRENTE = 28000;

const ID_TENSAO = 33;
const ID_CORRENTE = 32;

let isAMQPConnected = false;
let amqpChannelInfo = null;

const buffer = [];

const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 });
let partialData = '';

const measurementData = {
  tensaoAnterior: 0,
  correnteAnterior: 0,
};

port.on('data', (receivedData) => {
  // Acumular dados até formar uma mensagem completa
  partialData += receivedData.toString();

  // Verificar se temos uma mensagem completa
  const messages = partialData.split('T');

  // Processar cada mensagem completa
  messages.forEach((msg) => {
    if (msg.length >= 8) {
      // Extrair valores de tensão e corrente da mensagem
      const match = msg.match(/(\d+\.\d+)C(\d+\.\d+)/);

      if (match) {
        const tensao = parseFloat(match[1]);
        const corrente = parseFloat(match[2]);

        measurementData.tensaoAnterior = tensao;
        measurementData.correnteAnterior = corrente;

        console.log('Tensão:', tensao, 'Corrente:', corrente);

        // Enviar os dados para o servidor AMQP
        const timestamp = Date.now();
        sendToAMQP(ID_TENSAO, tensao, timestamp);
        sendToAMQP(ID_CORRENTE, corrente, timestamp);
      } else {
        // Ignorar mensagens desconhecidas
        console.warn('Mensagem desconhecida recebida:', msg);
      }
    }
  });

  // Manter qualquer dado não processado para o próximo evento 'data'
  partialData = messages[messages.length - 1];
});

const setupAMQPConnection = async (serverUrl) => {
  try {
    const amqpConnection = await amqp.connect(serverUrl);
    let channel = await amqpConnection.createChannel();

    console.log('Conectado ao servidor AMQP');

    amqpConnection.on('error', (err) => {
      console.error('Erro na conexão AMQP:', err);
      isAMQPConnected = false;
      channel = null;
      processBuffer();
    });

    return { amqpConnection, channel };
  } catch (error) {
    console.error('Erro ao configurar a conexão AMQP:', error);
    isAMQPConnected = false;
    return null;
  }
};

const initAMQPConnection = async () => {
  while (!amqpChannelInfo) {
    amqpChannelInfo = await setupAMQPConnection(amqpServerUrl);
    if (!amqpChannelInfo) {
      console.log('Tentando reconectar ao servidor AMQP em 5 segundos...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  isAMQPConnected = true; // Defina como verdadeiro após a conexão inicial
};

const checkInternet = () => {
  return new Promise((resolve) => {
    const targetHost = 'www.google.com';
    ping.sys.probe(targetHost, (isAlive) => {
      resolve(isAlive);
    });
  });
};

const sendToAMQP = async (idVariavel, valor, dataHora) => {
  try {
    if (!amqpChannelInfo || !isAMQPConnected) {
      console.error('A conexão AMQP não está disponível. Armazenando mensagem no buffer.');
      buffer.push({ idVariavel, valor, dataHora });
      return;
    }

    let { amqpConnection, channel } = amqpChannelInfo;

    if (!channel) {
      console.log('Reconectando ao servidor AMQP...');
      amqpChannelInfo = await setupAMQPConnection(amqpServerUrl);
      if (!amqpChannelInfo) {
        console.error('Falha ao reconectar à conexão AMQP.');
        return;
      }

      ({ channel } = amqpChannelInfo);
    }

    const mensagem = {
      id_variavel: idVariavel,
      valor: parseFloat(valor.toFixed(2)),
      data_hora: parseFloat(dataHora.toFixed(3)),
    };

    channel.sendToQueue(amqpQueue, Buffer.from(JSON.stringify(mensagem)));
    console.log('Mensagem enviada para a fila AMQP:', mensagem);
  } catch (error) {
    console.error('Erro ao enviar mensagem para a fila AMQP:', error);
  }
};

const processBuffer = async () => {
  while (buffer.length > 0) {
    const { idVariavel, valor, dataHora } = buffer.shift();
    await sendToAMQP(idVariavel, valor, dataHora);
  }
};

const startMeasurementLoop = async () => {
  await initAMQPConnection();

  while (true) {
    try {
      // Restante do código permanece inalterado
      // Substitua pelo seu código de medição com ads1115
      // ...

      await sleep(25); // Atraso de 25 milissegundos
    } catch (error) {
      console.error('Erro ao realizar medição:', error);
      // Se ocorrer um erro, coloque a mensagem no buffer
      buffer.push({ idVariavel: ID_TENSAO, valor: parseFloat(measurementData.tensaoAnterior.toFixed(2)), dataHora: Date.now() });
      buffer.push({ idVariavel: ID_CORRENTE, valor: parseFloat(measurementData.correnteAnterior.toFixed(2)), dataHora: Date.now() });
    }
  }
};

// Função para criar um atraso
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Iniciar o loop de medição e envio para o servidor AMQP
startMeasurementLoop();

module.exports = { startMeasurementLoop, data: measurementData };
