const ADS1115 = require('ads1115');
const i2c = require('i2c-bus');
const amqp = require('amqplib');
const ping = require('ping');

const amqpServerUrl = 'amqp://W4nuCL2HK09PrG8H:7NXYX2gGYHGxCIBKoN3UtsLfRh@trends.injetoras.tcsapp.com.br:5672';
const amqpQueue = 'measurements';
const nomeUsuario = 'W4nuCL2HK09PrG8H';
const senha = '7NXYX2gGYHGxCIBKoN3UtsLfRh';

const FILTRO = 0.03;
const LIMIAR_TENSAO = 28000;
const LIMIAR_CORRENTE = 28000;

let tensaoAnterior = 0;
let correnteAnterior = 0;

const ID_TENSAO = 33;
const ID_CORRENTE = 32;

let isAMQPConnected = false;
let amqpChannelInfo = null;

const buffer = [];

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

initAMQPConnection();

const checkInternet = () => {
  return new Promise((resolve) => {
    const targetHost = 'www.google.com';
    ping.sys.probe(targetHost, (isAlive) => {
      resolve(isAlive);
    });
  });
};

const data = {
  tensaoAnterior: 0,
  correnteAnterior: 0,
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
    //console.log('Mensagem enviada para a fila AMQP:', mensagem);
  } catch (error) {
    //console.error('Erro ao enviar mensagem para a fila AMQP:', error);
  }
};

const processBuffer = async () => {
  while (buffer.length > 0) {
    const { idVariavel, valor, dataHora } = buffer.shift();
    await sendToAMQP(idVariavel, valor, dataHora);
  }
};

const startMeasurementLoop = async () => {
  const bus = await i2c.openPromisified(1);
  const ads1115 = await ADS1115(bus);

  while (true) {
    try {
      let tensao = await ads1115.measure('0+GND');
      let corrente = await ads1115.measure('0+GND');

      // Limiar para Tensão
      if (tensao > LIMIAR_TENSAO) {
        tensao = 0;
      }

      // Limiar para Corrente
      if (corrente > LIMIAR_CORRENTE) {
        corrente = 0;
      }

      const tensaoMapeada = tensao * 0.0038355323718932;
      const correnteMapeada = corrente * 0.0230131942313593;

      data.tensaoAnterior = tensaoAnterior;
      data.correnteAnterior = correnteAnterior;

      if (tensaoMapeada <= 100) {
        if (tensaoAnterior + 100 * FILTRO < tensaoMapeada || tensaoAnterior - 100 * FILTRO > tensaoMapeada) {
          tensaoAnterior = parseFloat(tensaoMapeada.toFixed(2));
        }
      } else {
        tensaoAnterior = 100;
      }

      if (tensaoMapeada <= 0) {
        tensaoAnterior = 0;
      }

      if (correnteMapeada <= 600) {
        if (correnteAnterior + 600 * FILTRO < correnteMapeada || correnteAnterior - 600 * FILTRO > correnteMapeada) {
          correnteAnterior = parseFloat(correnteMapeada.toFixed(2));
        }
      } else {
        correnteAnterior = 600;
      }

      if (correnteMapeada <= 0) {
        correnteAnterior = 0;
      }

      const timestamp = Date.now();
      sendToAMQP(ID_TENSAO, tensaoAnterior, timestamp);
      sendToAMQP(ID_CORRENTE, correnteAnterior, timestamp);

      //console.log(`Tensão: ${tensaoAnterior}, Corrente: ${correnteAnterior}`);
      await sleep(25); // Atraso de 25 milissegundos

    } catch (error) {
      console.error('Erro ao realizar medição:', error);
      // Se ocorrer um erro, coloque a mensagem no buffer
      buffer.push({ idVariavel: ID_TENSAO, valor: parseFloat(tensaoAnterior.toFixed(2)), dataHora: Date.now() });
      buffer.push({ idVariavel: ID_CORRENTE, valor: parseFloat(correnteAnterior.toFixed(2)), dataHora: Date.now() });
    }
  }
};

// Função para criar um atraso
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
module.exports = { startMeasurementLoop, data };
