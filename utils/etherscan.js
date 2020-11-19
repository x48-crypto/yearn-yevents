const fetch = require("node-fetch");

const apiKey = app.config.etherscan.apiKey;

exports.getReadableAbiFields = (abi) => {
  const getReadableFields = (acc, field) => {
    const { name, inputs, stateMutability, outputs } = field;
    const nbrInputs = _.size(inputs);
    const nbrOutputs = _.size(outputs);
    const hasInputs = nbrInputs > 0;
    const hasOutputs = nbrOutputs > 0;
    const viewable = stateMutability === "view";
    if (!hasInputs && hasOutputs && name && viewable) {
      acc.push(name);
    }
    return acc;
  };
  const readableFields = [];
  _.reduce(abi, getReadableFields, readableFields);
  return readableFields;
};

exports.fetchMetadata = async (address) => {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const response = await fetch(url);
  const responseData = await response.json();
  const metadata = responseData.result[0];
  return metadata;
};

exports.fetchAbi = async (address) => {
  console.log(`Fetching ABI for ${address}`);
  let abi;
  let responseData;
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
    const response = await fetch(url);
    responseData = await response.json();
    abi = JSON.parse(responseData.result);
  } catch (err) {
    console.log("Etherscan error", responseData, err);
  }
  return abi;
};
