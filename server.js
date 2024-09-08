const express = require("express");
const cron = require("node-cron");
const {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const clientPromise = require("./mongo");
const connection = require("./solana");
require("dotenv").config();

const { TEST_PRIVATE_KEY, PROD_URI } = process.env;
const app = express();

const transferReward = async (payer, winnerAddress, rewardAmount) => {
  const recipientPublicKey = new PublicKey(winnerAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipientPublicKey,
      lamports: rewardAmount * 1000000000,
    })
  );

  await sendAndConfirmTransaction(connection, transaction, [payer]);
};

cron.schedule("* * * * *", async () => {
  let client;
  try {
    client = await clientPromise;
    await client.connect();

    const db = client.db("MemeMaster");
    const now = new Date();

    const expiredCompetitions = await db
      .collection("competitions")
      .find({ expireTime: { $lt: now }, status: { $ne: "complete" } })
      .toArray();

    if (expiredCompetitions.length > 0) {
      for (const competition of expiredCompetitions) {
        const winner = await db
          .collection("applies")
          .find({
            competationsId: String(competition._id),
          })
          .sort({ "like.length": -1 })
          .limit(1)
          .toArray();

        if (winner.length === 0) continue;

        const privateKeyArray = JSON.parse(TEST_PRIVATE_KEY);
        const privateKey = new Uint8Array(privateKeyArray);
        const senderKeypair = Keypair.fromSecretKey(privateKey);

        const rewardAmount = parseFloat(competition.reward);
        await transferReward(senderKeypair, winner[0].creator, rewardAmount);

        await fetch(PROD_URI, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: competition.image,
            name: competition.name,
            description: competition.description,
            creator: winner[0]?.creator,
          }),
        });

        await db
          .collection("competitions")
          .updateOne(
            { _id: competition._id },
            { $set: { status: "complete" } }
          );
      }
    }
  } catch (error) {
    console.error("Error running the scheduled task:", error);
  } finally {
    if (client) await client.close();
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
