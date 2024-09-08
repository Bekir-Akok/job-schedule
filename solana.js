const { Connection, clusterApiUrl } = require("@solana/web3.js");

const network = "testnet";
const connection = new Connection(clusterApiUrl(network), "confirmed");

module.exports = connection;
