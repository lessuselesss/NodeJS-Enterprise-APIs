# Circular Enterprise APIs for Data Certification

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Circular Protocol Enterprise APIs for data certification on the blockchain.

## Description

This library provides tools for creating and submitting data certificates to the Circular blockchain. It includes functionalities for managing accounts, setting network configurations, signing data, and interacting with the Circular Network Access Gateway (NAG).

## Features

-   **Account Management:** Open, update, and close accounts.
-   **Network Configuration:** Set blockchain network and address.
-   **Data Certification:** Create and submit data certificates.
-   **Data Signing:** Sign data using private keys.
-   **Transaction Monitoring:** Poll for transaction outcomes and retrieve transaction details.
-   **Hexadecimal Conversion:** Helper functions for hex string manipulation.
-   **Timestamp Generation:** Generate formatted UTC timestamps.

## Installation

```bash
npm install circular-enterprise-apis
```

## Usage

### CommonJS

You can find the examples in the dedicated folder.

```javascript
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
```

### ES Modules

```javascript
// main.mjs
import { CEP_Account } from 'circular-enterprise-apis';

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
        console.log("Updating Account");
        const updateResult = await account.updateAccount();
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
```

### API

#### `C_CERTIFICATE` Class

-   `setData(data)`: Sets the data content of the certificate.
-   `getData()`: Retrieves the data content of the certificate.
-   `getJSONCertificate()`: Returns the certificate as a JSON string.
-   `getCertificateSize()`: Returns the size of the certificate in bytes.

#### `CEP_Account` Class

-   `open(address)`: Opens an account with the given address.
-   `updateAccount()`: Updates the account's Nonce by querying the network.
-   `setNetwork(network)`: Sets the blockchain network.
-   `setBlockchain(chain)`: Sets the blockchain address.
-   `close()`: Closes the account and resets all fields.
-   `signData(data, privateKey)`: Signs data using the account's private key.
-   `submitCertificate(pdata, privateKey)`: Submits a certificate to the blockchain.
-   `GetTransactionOutcome(TxID, timeoutSec)`: Polls for transaction outcome.
-   `getTransactionbyID(TxID, Start, End)`: Searches for a transaction by its ID.

### Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

### License

This project is licensed under the MIT License.
