const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI;
let client;
let clientPromise;

client = new MongoClient(uri);
clientPromise = client.connect();

module.exports = clientPromise;
