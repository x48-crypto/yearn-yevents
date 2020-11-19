const WebSocket = require("ws");
const util = require("util");
const contracts = require("./utils/contracts");

let wss;

const sendInitialStates = (ws) => {
  const contractsState = contracts.getWatchedContractsState();
  const transactionsState = contracts.getCachedTransactions();
  const timestamp = Date.now();
  const stateUpdatesEvent = generateEvent(
    "stateUpdates",
    contractsState,
    timestamp
  );
  const transactionsEvent = generateEvent(
    "transactions",
    transactionsState,
    timestamp
  );
  ws.send(
    JSON.stringify({
      timestamp,
      events: [stateUpdatesEvent, transactionsEvent],
    })
  );
};

const generateEvent = (eventCode, payload, timestamp) => ({
  eventCode,
  timestamp,
  payload,
});

const WebSocketConnection = function () {
  wss = new WebSocket.Server({ port: 8080 });
  wss.on("connection", sendInitialStates);
};

const broadcast = (msg) => {
  console.log(util.inspect(msg, false, null, true));
  const msgStr = JSON.stringify(msg);
  const sendMessage = (client) => {
    client.send(msgStr);
  };
  wss.clients.forEach(sendMessage);
};

WebSocketConnection.prototype = { broadcast, generateEvent };

module.exports = new WebSocketConnection();
