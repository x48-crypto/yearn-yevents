const { web3 } = app;
const delay = require("delay");
const etherscan = require("../utils/etherscan");
const abiDecoder = require("abi-decoder");
const { getReadableAbiFields } = require("../utils/etherscan");

let watchedContracts = {};
let cachedTransactions = [];

const getContractsState = async (contracts) => {
  const batch = new web3.BatchRequest();
  const addContractToBatch = (contractConfig) => {
    const { address, contract, methods } = contractConfig;
    const contractPromise = async (contractResolve) => {
      const addMethodToBatch = (method) => {
        const methodPromise = (methodResolve, methodReject) => {
          const methodCall = contract.methods[method]().call;
          const returnResponse = (err, data) => {
            if (err) {
              methodReject(err);
            } else {
              methodResolve({
                method,
                value: data,
              });
            }
          };
          const req = methodCall.request(null, returnResponse);
          batch.add(req);
        };
        return new Promise(methodPromise);
      };

      const reduceMethods = (acc, state) => {
        const { method, value } = state;
        acc[method] = value;
        return acc;
      };

      const methodsPromises = await methods.map(addMethodToBatch);
      const methodsState = await Promise.all(methodsPromises);
      const methodsStateReduced = _.reduce(methodsState, reduceMethods, {
        address,
      });
      contractResolve(methodsStateReduced);
    };
    return new Promise(contractPromise);
  };
  const contractsPromises = contracts.map(addContractToBatch);
  batch.execute();
  const contractsState = await Promise.all(contractsPromises);
  return contractsState;
};

const addWatchedContract = async (address) => {
  const abi = await etherscan.fetchAbi(address);
  await delay(300);
  const contract = new web3.eth.Contract(abi, address);
  const methods = getReadableAbiFields(abi);
  const watchedContract = { contract, methods, address };
  abiDecoder.addABI(abi);
  watchedContracts[address] = watchedContract;
  return watchedContract;
};

const updateContractsState = async (addresses) => {
  const filterContracts = (contract) => _.includes(addresses, contract.address);
  const contracts = _.filter(watchedContracts, filterContracts);
  const contractsState = await getContractsState(contracts);
  const updateContractState = (contractState) => {
    watchedContracts[contractState.address].state = contractState;
  };
  _.each(contractsState, updateContractState);
  return contractsState;
};

const findWatchedContractAddressFromTransaction = (transaction) => {
  const watchedContractsAddresses = getWatchedContractsAddresses();
  const fromMatch = _.includes(watchedContractsAddresses, transaction.from)
    ? transaction.from
    : false;
  const toMatch = _.includes(watchedContractsAddresses, transaction.to)
    ? transaction.to
    : false;
  return fromMatch || toMatch;
};

const getTransactionsWithData = (filteredTransactions) => {
  const extractMethodAndArgs = (acc, transaction) => {
    const { input } = transaction;
    const contractAddress = findWatchedContractAddressFromTransaction(
      transaction
    );
    const decodedInput = abiDecoder.decodeMethod(input);
    acc.push({
      contractAddress,
      ...transaction,
      method: decodedInput,
    });
    return acc;
  };
  const transactionsWithData = _.reduce(
    filteredTransactions,
    extractMethodAndArgs,
    []
  );

  return transactionsWithData;
};

const getContractsStateUpdates = async (contractsAddresses) => {
  const contractsPendingUpdate = _.size(contractsAddresses);
  if (!contractsPendingUpdate) {
    return null;
  }
  const watchedContractsState = getWatchedContractsState();

  const filterContractsByAddress = (contract) =>
    _.includes(contractsAddresses, contract.address);

  const oldContractsState = _.filter(
    watchedContractsState,
    filterContractsByAddress
  );

  const newContractsState = await updateContractsState(contractsAddresses);
  const oldStatesObj = _.keyBy(oldContractsState, "address") || {};
  const newStatesObj = _.keyBy(newContractsState, "address");
  const updatedStates = _.map(_.extend(oldStatesObj, newStatesObj));

  const findContractsDiff = (oldStates, newStates) => {
    const checkDiff = (acc, contractState) => {
      const contractAddress = contractState.address;
      const checkForPropertyDiff = (acc, newPropertyValue, propertyName) => {
        const oldContract =
          _.find(oldStates, { address: contractAddress }) || {};
        const oldPropertyValue = oldContract[propertyName];
        if (newPropertyValue !== oldPropertyValue) {
          acc[propertyName] = newPropertyValue;
        }
        return acc;
      };
      let contractUpdateNew = _.reduce(contractState, checkForPropertyDiff, {});
      const contractHasUpdates = _.size(contractUpdateNew);
      if (contractHasUpdates) {
        contractUpdateNew.address = contractAddress;
        acc.push(contractUpdateNew);
      }
      return acc;
    };
    const updatesAll = _.reduce(newStates, checkDiff, []);
    return updatesAll;
  };

  const contractsDiff = findContractsDiff(watchedContractsState, updatedStates);
  return contractsDiff;
};

const cacheTransactions = (transactions) => {};

const receivedBlockHeader = async (err, header) => {
  if (err) {
    console.log("Block header error:", err);
    return;
  }
  const { number: blockNumber } = header;
  let block;

  try {
    block = await web3.eth.getBlock(blockNumber, true);
  } catch (err) {
    console.log("error fetching block", err);
  }

  const { transactions } = block;
  const filteredTransactions = _.filter(
    transactions,
    findWatchedContractAddressFromTransaction
  );

  const transactionsWithData = getTransactionsWithData(filteredTransactions);
  const touchedContractAddresses = _.map(
    transactionsWithData,
    (transaction) => transaction.contractAddress
  );

  const stateUpdates = await getContractsStateUpdates(touchedContractAddresses);
  const events = [];
  const foundNewTransactions = _.size(transactionsWithData);
  const foundNewStateUpdates = _.size(stateUpdates);
  const timestamp = Date.now();

  const injectTimestamp = (transaction) => {
    transaction.timestamp = timestamp;
    return transaction;
  };
  const transactionsWithDataAndTimestamps = _.map(
    transactionsWithData,
    injectTimestamp
  );

  if (foundNewTransactions) {
    const transactionsStackMax = 200;

    cachedTransactions.unshift(...transactionsWithDataAndTimestamps);
    cachedTransactions = _.slice(cachedTransactions, 0, transactionsStackMax);
    const event = app.wss.generateEvent(
      "transactions",
      transactionsWithDataAndTimestamps,
      timestamp
    );
    events.push(event);
  }
  if (foundNewStateUpdates) {
    const event = app.wss.generateEvent(
      "stateUpdates",
      stateUpdates,
      timestamp
    );
    events.push(event);
  }

  const hasNewEvents = events.length;
  if (hasNewEvents) {
    app.wss.broadcast({
      timestamp,
      events,
    });
  }
};

const startWatchingForStateChanges = () => {
  console.log("Subscribing to new block headers");
  web3.eth.subscribe("newBlockHeaders", receivedBlockHeader);
};

const addWatchedContracts = async (addresses) => {
  console.log("Adding watched contracts", addresses);
  for (const address of addresses) {
    await addWatchedContract(address);
  }
  await updateContractsState(addresses);
};

const getWatchedContractsAddresses = () =>
  _.map(watchedContracts, (watchedContract) => watchedContract.address);

const getCachedTransactions = () => {
  return cachedTransactions.reverse();
};

const getWatchedContractsState = () =>
  _.map(watchedContracts, (watchedContract) => watchedContract.state);

module.exports = {
  addWatchedContracts,
  startWatchingForStateChanges,
  getWatchedContractsState,
  getCachedTransactions,
};
