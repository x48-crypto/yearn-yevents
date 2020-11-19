#! /usr/bin/env node

app = {};

process.on("uncaughtException", function (exception) {
  console.log("uncaughtException: " + exception.stack);
});

require("./common");
const yearn = require("./platforms/yearn");
const contracts = require("./utils/contracts");

const start = async () => {
  const vaults = await yearn.getVaults();
  const vaultAddresses = _.map(vaults, (vault) => vault.address);
  await contracts.addWatchedContracts(vaultAddresses);
  contracts.startWatchingForStateChanges();
};

start();
