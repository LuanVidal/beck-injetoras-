const mqtt = require('mqtt');
const { exec } = require('child_process');

const ssid = "EGR-FIBRA_2.4G-ROSEMEIRE";
const password = "11151821";
const ntpServer = "pool.ntp.org";
const mqtt_user = "Vn1zj0dwxiX9CmBM";
const mqtt_password = "ld39C62kLj0Jv9VIxsmdnm257i45pP6H";
const BROKER_MQTT = "mqtt://144.202.45.101";
const BROKER_PORT = 1883;
const ID_MQTT = "1";
const TOPIC_PUBLISH = "measurements";
const OPTO_PIN = 39;

let epochTime;
let estado_anterior = false;

const wifi = require('node-wifi');
const mqttClient  = mqtt.connect(BROKER_MQTT, {
  port: BROKER_PORT,
  username: mqtt_user,
  password: mqtt_password
});

function getTime() {
  return Math.floor(new Date().getTime() / 1000);
}

async function setup() {
  await wifi.init({
    iface: null // use the first available network interface
  });
  await conectaWiFi();
  
  mqttClient.on('connect', function () {
    console.log('Conectado ao broker MQTT');
  });

  mqttClient.on('error', function (error) {
    console.error('Erro de conexão MQTT:', error);
  });

  setInterval(mantemConexoes, 60000); // Mantém as conexões a cada 1 minuto
  setInterval(() => {
    // Ler o estado do pino optoacoplador
    exec(`gpio read ${OPTO_PIN}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao ler o pino optoacoplador: ${error.message}`);
        return;
      }

      const estado_atual = parseInt(stdout.trim());

      // Verificar se o estado mudou
      if (estado_atual !== estado_anterior) {
        estado_anterior = estado_atual;

        if (estado_atual === 1) {
          console.log("Injetora ligada");
        } else {
          console.log("Injetora desligada");
        }

        enviaValores(estado_atual);
      }
    });
  }, 500);
}

async function mantemConexoes() {
  await conectaWiFi();
}

async function conectaWiFi() {
  const currentConnections = await wifi.getCurrentConnections();

  if (currentConnections.length > 0 && currentConnections[0].ssid === ssid) {
    return;
  }

  console.log(`Conectando-se na rede: ${ssid}. Aguarde!`);
  await wifi.connect({ ssid, password });
  console.log("Conectado com sucesso à rede:", ssid);
  console.log("IP obtido:", await wifi.getIP());
}

function conectaMQTT() {
  console.log("Conectando ao broker MQTT...");
  mqttClient.connect();
}

function enviaValores(estado_injetora) {
  epochTime = getTime();

  const mqttMessageTensao = `{"id_maquina": ${ID_MQTT}, "valor": ${estado_injetora}, "data_hora": ${epochTime}}`;
  mqttClient.publish(TOPIC_PUBLISH, mqttMessageTensao);
}

setup();
