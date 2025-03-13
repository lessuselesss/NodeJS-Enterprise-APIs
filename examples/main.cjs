// main.cjs
const { CEP_Account } = require('circular-enterprise-apis');

const Address = 'your-wallet-address';
const PrivateKey = 'your-private-key';
const blockchain = '0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2';

let account = new CEP_Account();
let txID;
let txBlock;

async function run() {
    try {
        console.log("Opening Account");
        account.open(Address);
        account.setBlockchain(blockchain);
        account.setNetwork("testnet");
        console.log(account.NAG_URL);
        console.log(account.NETWORK_NODE);
        console.log("Updating Account");
        const updateResult = await account.updateAccount();
        console.log("Account updated");
        if (!updateResult) {
            console.log("Account Failed to Update");
            return;
        }
        console.log("Account up to date");
        console.log("Nonce : ", account.Nonce);

        console.log("Submitting Transaction");
        const submitResult = await account.submitCertificate("test Enterprise APIs", PrivateKey);

        console.log("Result :", submitResult);
        if (submitResult.Result === 200) {
            console.log("Certificate submitted successfully:", submitResult);
            txID = submitResult.Response.TxID;

            console.log("Getting Transaction Outcome");
            const outcome = await account.GetTransactionOutcome(txID, 25);
            console.log("Report ", outcome);
            console.log(JSON.stringify(outcome));

            if (outcome.Result === 200) {
                txBlock = outcome.BlockID;
                console.log("Transaction ID:", txID);
                console.log("Transaction Block:", txBlock);

                console.log("Searching Transaction");
                const getTxResult = await account.getTransaction(txBlock, txID);
                console.log("Get Transaction Result :", getTxResult);

                if (getTxResult.Result === 200) {
                    console.log("Certificate found :", getTxResult);
                    
                } else {
                    console.log("Certificate Not Found :", getTxResult.message);
                }
            }

        } else {
            console.log("Failed to submit certificate:", submitResult.message);
        }

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        account.close();
        console.log("Account Closed");
    }
}

run();
