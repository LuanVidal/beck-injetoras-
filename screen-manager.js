const fs = require("fs");

class ScreenManager {
  constructor(io, data) {
    this.matricula = "";
    this.ordemproducao = "";
    this.id = "";
    this.consumivel = "";
    this.currentScreen = "home";
    this.mec = "8C:AA:B5:6A:78:F0";
    this.data = data;
    this.io = io;

    this.initialize();

    this.screens = {
      home: {
        action: () => {
          this.sendDataToServer("carregamento", "Carregando...");
        },
      },
      retoma: {
        action: () => {
          this.sendDataToServer("retoma", "retoma");
        },
      },
      matricula: {
        action: () => {
          this.sendDataToServer("matricula", this.matricula);
        },
      },
      ordemproducao: {
        action: () => {
          this.sendDataToServer("ordemProducao", this.ordemproducao);
          console.log("DENTRO DA ORDEM");
        },
      },
      id: {
        action: () => {
          this.sendDataToServer("idNumber", this.id);
        },
      },
      consumivel: {
        action: () => {
          this.sendDataToServer("consumivel", this.consumivel);
        },
      },
      validando: {
        action: async () => {
          console.log("VALIDANDO");
          const requestBody = {
            matricula: this.matricula,
            mac: this.mec,
            ordemProducao: this.ordemproducao,
            atividade: this.id,
            material: this.consumivel,
          };

          try {
            const response = await this.fazerRequisicaoHTTPComValidacao(
              "/delp/arduino/inicioProcesso",
              requestBody
            );
            console.log(requestBody);

            if (response) {
              console.log("Requisição bem-sucedida:", response);
              this.showPopup(
                "Sucesso",
                "Rastreabilidade Iniciada com Sucesso",
                "success"
              );
              this.currentScreen = "rastreabilidade";
              this.changeScreenTo("rastreabilidade");
              this.io.emit("changepath", "rastreabilidade");
            } else {
              console.error("Erro na requisição:", this.lastError);
              
              const errorMessage = this.lastError && this.lastError.error ? this.lastError.error : (this.lastError ? this.lastError.toString() : "Erro desconhecido");
              this.showPopup("ERRO", errorMessage, "error");

              this.resetVariables();

              this.currentScreen = "matricula";
              this.io.emit("changepath", "matricula"); // Altere para a tela desejada em caso de falha
            }
          } catch (error) {
            console.error("Erro na requisição:", this.lastError);
            this.showPopup(
              "Erro",
              "Erro na requisição. Tente novamente.",
              "error"
            );

            resetVariables();

            this.currentScreen = "matricula";
            this.io.emit("changepath", "matricula"); // Altere para a tela desejada em caso de falha
          }
        },
      },
      rastreabilidade: {
        action: () => {
          this.sendDataToServer("telaRastreabilidade", "telaRastreabilidade");
        this.sendDataToServer("parameters", { Corrente: this.data.correnteAnterior, Tensao: this.data.tensaoAnterior });

        // Verifica se há um intervalo existente e o limpa
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }

        // Reinicia o temporizador após a pausa
        this.intervalId = setInterval(() => {
          // Envia os dados atualizados
          this.io.emit("parameters", {
            Corrente: this.data.correnteAnterior,
            Tensao: this.data.tensaoAnterior,
          });
        }, 500);
        },
      },
      finaliza: {
        action: () => {
          this.sendDataToServer("finalizaProcesso", "finalizaProcesso");
        },
      },
    };
  }

  setIO(io) {
    this.io = io;
  }

  saveConfigurationToFile() {
    const configData = {
      matricula: this.matricula,
      ordemproducao: this.ordemproducao,
      id: this.id,
      consumivel: this.consumivel,
    };

    const configFilePath = "config.json";

    fs.writeFileSync(configFilePath, JSON.stringify(configData), "utf-8");
    console.log("Configurações salvas em", configFilePath);
  }

  loadConfigurationFromFile() {
    const configFilePath = "config.json";

    try {
      // Verifica se o arquivo existe
      if (fs.existsSync(configFilePath)) {
        const configData = fs.readFileSync(configFilePath, "utf-8");

        // Verifica se o arquivo está vazio
        if (configData.trim() === "") {
          console.log(
            "Arquivo de configuração vazio. Direcionando para tela de matrícula."
          );
          this.currentScreen = "matricula";
          this.screens[this.currentScreen].action();
          this.io.emit("changepath", "matricula");
          return;
        }

        const parsedConfig = JSON.parse(configData);

        this.matricula = parsedConfig.matricula || "";
        this.ordemproducao = parsedConfig.ordemproducao || "";
        this.id = parsedConfig.id || "";
        this.consumivel = parsedConfig.consumivel || "";

        console.log("Configurações carregadas do arquivo", configFilePath);

        // Se o arquivo não estiver vazio, envie os dados retomados através do io.emit
        const retomaObject = {
          matricula: this.matricula,
          ordemProd: this.ordemproducao,
          id: this.id,
          consumivel: this.consumivel,
          tempoPercorrido: "10",
          tempoInicial: "10",
        };

        this.io.emit("changepath", "retoma");
        this.currentScreen = "retoma";
        this.io.emit("retoma-params", retomaObject);
      } else {
        console.log(
          "Arquivo de configuração não encontrado. Direcionando para tela de matrícula."
        );
        this.currentScreen = "matricula";
        this.screens[this.currentScreen].action();
        this.io.emit("changepath", "matricula");
      }
    } catch (error) {
      console.error(
        "Erro ao carregar configurações do arquivo",
        configFilePath
      );
    }
  }

  async initialize() {
    // Faça uma requisição HTTP na tela 'home'
    try {
      const success = await this.makeHttpRequestOnHome();

      if (success) {
        // Se a requisição for bem-sucedida, carrega as configurações do arquivo
        this.loadConfigurationFromFile();
      } else {
        // Se a requisição falhar, mostra uma mensagem de erro e tenta novamente
        this.showPopup("ERRO", "Erro na requisição. Tente novamente.", "error");
        setTimeout(() => this.initialize(), 2000); // Tenta novamente após 2 segundos
      }
    } catch (error) {
      console.error("Erro na inicialização:", error);
      this.showPopup(
        "ERRO",
        "Erro na inicialização. Tente novamente.",
        "error"
      );
      setTimeout(() => this.initialize(), 2000); // Tenta novamente após 2 segundos
    }
  }

  async makeHttpRequestOnHome() {
    // Lógica da sua requisição HTTP na tela 'home'
    const requestBody = {
      mac: this.mec,
    };

    try {
      const response = await this.fazerRequisicaoHTTPComValidacao(
        "/delp/arduino/status",
        requestBody
      );

      if (response) {
        console.log("Requisição bem-sucedida:", response.data);
        return true;
      } else {
        console.error("Erro na requisição:", response);
        this.lastError = "Erro desconhecido na requisição.";
        return false;
      }
    } catch (error) {
      console.error("Erro na requisição:", error.message);
      this.lastError = error.message;
      return false;
    }
  }

  resetVariables() {
    this.matricula = "";
    this.ordemproducao = "";
    this.id = "";
    this.consumivel = "";
  }

  showPopup(title, text, type = "error", time = 2000) {
    this.io.emit("swal", {
      title: title,
      text: text,
      type: type,
      time: time,
    });
  }

  async fazerRequisicaoHTTP(host, port, endpoint, requestBody) {
    const url = `https://${host}:${port}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const textResponse = await response.text();
      console.log("Response from server:", textResponse);

      if (response.ok) {
        try {
          const data = JSON.parse(textResponse);
          return {
            status: response.status,
            data: data,
          };
        } catch (jsonError) {
          // Se não for possível fazer o parsing como JSON, retorna apenas o texto
          console.error("Error parsing JSON:", jsonError);
          return {
            status: response.status,
            data: textResponse,
          };
        }
      } else {
        console.error("Error in request:", textResponse);
        throw new Error(textResponse);
      }
    } catch (error) {
      console.error("Error in request:", error.message);
      throw error;
    }
  }

  async fazerRequisicaoHTTPComValidacao(endpoint, requestBody) {
    try {
      const response = await this.fazerRequisicaoHTTP(
        "delp.tcsapp.com.br",
        443,
        endpoint,
        requestBody
      );

      if (response.status === 200) {
        console.log("Requisição bem-sucedida:", response.data);
        return true;
      } else {
        console.error("Erro na requisição:", response.data);
        this.lastError = response.data;
        return false;
      }
    } catch (error) {
      console.error("Erro na requisição:", error.message);
      this.lastError = error.message;
      return false;
    }
  }

  logVariableValues() {
    console.log("Matrícula:", this.matricula);
    console.log("Ordem de Produção:", this.ordemproducao);
    console.log("ID Number:", this.id);
    console.log("Consumível:", this.consumivel);
    console.log("Tela Atual:", this.currentScreen);
  }

  async pausarRastreabilidade() {
    const requestBody = {
      mac: this.mec,
    };

    try {
      const response = await this.fazerRequisicaoHTTPComValidacao(
        "/delp/arduino/pausaProcesso",
        requestBody
      );

      if (response) {
        this.showPopup("Sucesso", "Processo pausado com sucesso", "success");
        this.io.emit("rastreabilidade", "pausa");
        this.currentScreen = "pausa";
        return true;
      } else {
        console.error("Erro na requisição:", response);
        this.showPopup(
          "ERRO",
          "Erro ao pausar a rastreabilidade. Tente novamente.",
          "error"
        );
        return false;
      }
    } catch (error) {
      console.error("Erro na requisição:", error.message);
      this.showPopup(
        "ERRO",
        "Erro ao pausar a rastreabilidade. Tente novamente.",
        "error"
      );
      return false;
    }
  }

  async reiniciarRastreabilidade() {
    const requestBody = {
      mac: this.mec,
    };

    try {
      const response = await this.fazerRequisicaoHTTPComValidacao(
        "/delp/arduino/reiniciaProcesso",
        requestBody
      );

      if (response) {
        console.log("Requisição bem-sucedida:", response.data);
        this.showPopup("Sucesso", "Processo reiniciado com sucesso", "success");
        this.io.emit("rastreabilidade", "inicia");
        this.currentScreen = "rastreabilidade";

        return true;
      } else {
        console.error("Erro na requisição:", response);
        this.showPopup(
          "ERRO",
          "Erro ao reiniciar a rastreabilidade. Tente novamente.",
          "error"
        );
        return false;
      }
    } catch (error) {
      console.error("Erro na requisição:", error.message);
      this.showPopup(
        "ERRO",
        "Erro ao reiniciar a rastreabilidade. Tente novamente.",
        "error"
      );
      return false;
    }
  }

  async finalizarProcesso() {
    const requestBody = {
      matricula: this.matricula,
      mac: this.mec,
      ordemProducao: this.ordemproducao,
      atividade: this.id,
      material: this.consumivel,
    };

    this.saveConfigurationToFile();

    try {
      const response = await this.fazerRequisicaoHTTPComValidacao(
        "/delp/arduino/terminoProcesso",
        requestBody
      );

      if (response) {
        console.log("Requisição bem-sucedida:", response.data);
        this.showPopup(
          "Sucesso",
          "Processo finalizado com sucesso.",
          "success"
        );
        this.resetVariables();
        this.loadConfigurationFromFile();
      } else {
        console.error("Erro na requisição:", response);
        this.showPopup(
          "ERRO",
          "Erro ao finalizar o processo. Tente novamente.",
          "error"
        );
      }
    } catch (error) {
      console.error("Erro na requisição:", error.message);
      this.showPopup(
        "ERRO",
        "Erro ao finalizar o processo. Tente novamente.",
        "error"
      );
    }
  }

  handleKey(key) {
    switch (key) {
      case "-":
        this.handleDelete();
        break;
      case "*":
        if (this.currentScreen === "rastreabilidade") {
          this.handleNext();
        } else if (this.currentScreen === "matricula") {
        } else if (this.currentScreen === "retoma") {
          this.matricula = "";
          this.ordemproducao = "";
          this.id = "";
          this.consumivel = "";

          this.currentScreen = "matricula";
          this.screens[this.currentScreen].action();
          this.io.emit("changepath", "matricula");
        } else {
          this.handleBack();
        }
        break;
      case "\r":
        if (this.currentScreen === "rastreabilidade") {
          // ação de pausar
          this.pausarRastreabilidade();
        } else if (this.currentScreen === "pausa") {
          //ação de iniciar
          this.reiniciarRastreabilidade();
        } else if (this.currentScreen === "finaliza") {
          this.finalizarProcesso();
        } else if (this.currentScreen === "retoma") {
          this.currentScreen = "validando";
          this.io.emit("changepath", "validando");
          this.screens["validando"].action();
        } else {
          this.handleNext();
        }
        break;
      default:
        this.handleCharacter(key);
        break;
    }
  }

  handleDelete() {
    if (this[this.currentScreen] !== "") {
      this[this.currentScreen] = this[this.currentScreen].slice(0, -1);
      this.screens[this.currentScreen].action();
    }
    this.logVariableValues();
  }

  handleBack() {
    const screenOrder = Object.keys(this.screens);
    const currentIndex = screenOrder.indexOf(this.currentScreen);

    if (currentIndex > 0) {
      const previousScreen = screenOrder[currentIndex - 1];
      this.currentScreen = previousScreen;
      this.io.emit("changepath", previousScreen);
      console.log(this.currentScreen);
      this.logVariableValues();
      this.screens[this.currentScreen].action();
      return previousScreen;
    } else {
      // Se já estiver na primeira tela, não há tela anterior
      return null;
    }
  }

  handleNext() {
    this.changeScreenTo(this.getNextScreen());
  }

handleCharacter(key) {
    console.log("Current Screen:", this.currentScreen);

    // Lista de telas que não devem aceitar números
    const screensWithoutNumbers = ["retoma", "rastreabilidade", "finaliza"];

    // Verifica se a tela atual não aceita números
    if (screensWithoutNumbers.includes(this.currentScreen)) {
        console.log(`A tela ${this.currentScreen} não aceita números.`);
        return;
    }

    const maxDigits = {
        matricula: 5,
        ordemproducao: 7,
        id: 2,
        consumivel: 2,
    };

    // Inicializa a propriedade se não estiver definida
    this[this.currentScreen] = this[this.currentScreen] || '';

    // Verifica se a propriedade está definida antes de acessá-la
    if (this.currentScreen && this[this.currentScreen].length < maxDigits[this.currentScreen]) {
        // Verifica se o caractere é um número
        if (!isNaN(Number(key))) {
            this[this.currentScreen] += key;
            this.screens[this.currentScreen].action();
        }
    }

    this.logVariableValues(); // Mostra os valores após a modificação
}

  sendDataToServer(param, msg) {
    this.io.emit(param, msg);
  }

  changeScreenTo(screenName) {
    if (this.screens[screenName]) {
      this.currentScreen = screenName;
      this.screens[this.currentScreen].action();
    }
  }

  getPreviousScreen() {
    const screenOrder = Object.keys(this.screens);
    const currentIndex = screenOrder.indexOf(this.currentScreen);

    if (currentIndex > 0) {
      const previousScreen = screenOrder[currentIndex - 1];
      this.currentScreen = previousScreen;
      this.io.emit("keyboard", previousScreen);
      console.log(this.currentScreen);
      return previousScreen;
    } else {
      // Se já estiver na primeira tela, não há tela anterior
      return null;
    }
  }

  getNextScreen() {
    const screenOrder = Object.keys(this.screens);
    const currentIndex = screenOrder.indexOf(this.currentScreen);

    if (currentIndex < screenOrder.length - 1) {
      const nextScreen = screenOrder[currentIndex + 1];
      this.currentScreen = nextScreen;
      this.io.emit("changepath", nextScreen);
      console.log(this.currentScreen);
      return nextScreen;
    } else {
      // Se já estiver na última tela, não há tela seguinte
      return null;
    }
  }
}

module.exports = ScreenManager;
