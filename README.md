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

```javascript
const { CEP_Account, C_CERTIFICATE } = require('circular-enterprise-apis');

async function main() {
    const account = new CEP_Account();
    const privateKey = 'YOUR_PRIVATE_KEY_HERE'; // Replace with your actual private key
    const address = 'YOUR_ACCOUNT_ADDRESS_HERE'; // Replace with your actual account address
    const dataToCertify = 'Your data to certify';

    try {
        account.open(address);
        await account.setNetwork('testnet'); // Set network (devnet, testnet, mainnet)
        account.setBlockchain('YOUR_BLOCKCHAIN_ADDRESS_HERE'); // Replace with your blockchain address
        await account.updateAccount();

        const certificate = new C_CERTIFICATE();
        certificate.setData(dataToCertify);

        const response = await account.submitCertificate(certificate.getJSONCertificate(), privateKey);

        if (response && response.Result === 200) {
            console.log('Certificate submitted successfully:', response);
            const outcome = await account.GetTransactionOutcome(response.Response.ID, 60);
            console.log("Transaction outcome: ", outcome);
        } else {
            console.error('Certificate submission failed:', response);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        account.close();
    }
}

main();
```

### ES Modules

```javascript
import { CEP_Account, C_CERTIFICATE } from 'circular-enterprise-apis';

async function main() {
    const account = new CEP_Account();
    const privateKey = 'YOUR_PRIVATE_KEY_HERE';
    const address = 'YOUR_ACCOUNT_ADDRESS_HERE';
    const dataToCertify = 'Your data to certify';

    try {
        account.open(address);
        await account.setNetwork('devnet');
        account.setBlockchain('YOUR_BLOCKCHAIN_ADDRESS_HERE');
        await account.updateAccount();

        const certificate = new C_CERTIFICATE();
        certificate.setData(dataToCertify);

        const response = await account.submitCertificate(certificate.getJSONCertificate(), privateKey);

        if (response && response.Result === 200) {
            console.log('Certificate submitted successfully:', response);
            const outcome = await account.GetTransactionOutcome(response.Response.ID, 60);
            console.log("Transaction outcome: ", outcome);
        } else {
            console.error('Certificate submission failed:', response);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        account.close();
    }
}

main();
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
