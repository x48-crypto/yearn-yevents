const Web3 = require("web3");

function Conn() {
  const web3 = new Web3(app.config.web3.provider);
  return web3;
}

module.exports = new Conn();
