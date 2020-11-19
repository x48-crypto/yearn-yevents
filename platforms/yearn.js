/*********
 * YEARN *
 *********/

const fetch = require("node-fetch");

exports.getVaults = async () => {
  console.log("Fetching vaults");
  const url = "https://api.yearn.tools/vaults";
  const resp = await fetch(url);
  const vaults = await resp.json();
  return vaults;
};
