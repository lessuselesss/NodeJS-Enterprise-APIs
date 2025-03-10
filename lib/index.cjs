const { ec } = require('elliptic');
const sha256 = require('sha256');
const http = require('http');
const url = require('url');

/******************************************************************************* 

        CIRCULAR Enterprise APIs for Data Certification
         
        License : Open Source for private and commercial use
                     
        CIRCULAR GLOBAL LEDGERS, INC. - USA
                     
        Version : 1.0.1
                     
        Creation: 2/5/2025
        Update  : 2/5/2025
                  
        Originator: Gianluca De Novi, PhD
        Contributors: <names here>           
        
*******************************************************************************/
/* Library Details ************************************************************/
const LIB_VERSION = '1.0.13';
const NETWORK_URL = 'https://circularlabs.io/network/getNAG?network=';
const DEFAULT_CHAIN = '0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2';
const DEFAULT_NAG = 'https://nag.circularlabs.io/NAG.php?cep=';

/* HELPER FUNCTIONS ***********************************************************/

/**
 * Function to add a leading zero to numbers less than 10
 * @param {number} num - Number to pad
 * @returns {string} Padded number as a string
 */
function padNumber(num) {
    return num < 10 ? '0' + num : num.toString();
}

/**
 * Returns a formatted timestamp in UTC
 * @returns {string} Formatted timestamp (YYYY:MM:DD-HH:MM:SS)
 */
function getFormattedTimestamp() {
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = padNumber(date.getUTCMonth() + 1);
    const day = padNumber(date.getUTCDate());
    const hours = padNumber(date.getUTCHours());
    const minutes = padNumber(date.getUTCMinutes());
    const seconds = padNumber(date.getUTCSeconds());

    return `${year}:${month}:${day}-${hours}:${minutes}:${seconds}`;
}

/**
 * Removes '0x' from hexadecimal strings if present
 * @param {string} word - Hexadecimal string
 * @returns {string} Hexadecimal string without '0x'
 */
function HexFix(word) {
    if (typeof word === 'string') {
        return word.startsWith('0x') ? word.slice(2) : word;
    }
    return '';
}

/**
 * Converts a string to its hexadecimal representation
 * @param {string} str - Input string
 * @returns {string} Hexadecimal representation of the string
 */
function stringToHex(str) {
    let hexString = '';
    for (let i = 0; i < str.length; i++) {
        const hex = str.charCodeAt(i).toString(16);
        hexString += ('00' + hex).slice(-2);
    }
    return hexString;
}

/**
 * Converts a hexadecimal string to a regular string
 * @param {string} hex - Hexadecimal string
 * @returns {string} Regular string
 */
function hexToString(hex) {
    hex = HexFix(hex);
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (!isNaN(code) && code !== 0) {
            str += String.fromCharCode(code);
        }
    }
    return str;
}

/*******************************************************************************
 * Circular Certificate Class for certificate chaining
 */
class C_CERTIFICATE {
    constructor() {
        this.data = null;
        this.previousTxID = null;
        this.previousBlock = null;
        this.codeVersion = LIB_VERSION;
    }

    /**
     * Inserts application data into the certificate
     * @param {string} data - Data content
     */
    setData(data) {
        this.data = stringToHex(data);
    }

    /**
     * Extracts application data from the certificate
     * @returns {string} Data content
     */
    getData() {
        return hexToString(this.data);
    }

    /**
     * Returns the certificate in JSON format
     * @returns {string} JSON string representation of the certificate
     */
    getJSONCertificate() {
        const certificate = {
            data: this.data,
            previousTxID: this.previousTxID,
            previousBlock: this.previousBlock,
            version: this.codeVersion,
        };
        return JSON.stringify(certificate);
    }

    /**
     * Returns the size of the certificate in bytes
     * @returns {number} Size of the certificate in bytes
     */
    getCertificateSize() {
        const jsonString = this.getJSONCertificate();
        return Buffer.byteLength(jsonString, 'utf8');
    }
}

/*******************************************************************************
 * Circular Account Class
 */
class CEP_Account {
    constructor() {
        this.address = null;
        this.publicKey = null;
        this.info = null;
        this.codeVersion = LIB_VERSION;
        this.lastError = '';
        this.NAG_URL = DEFAULT_NAG;
        this.NETWORK_NODE = '';
        this.blockchain = DEFAULT_CHAIN;
        this.LatestTxID = '';
        this.Nonce = 0;
        this.data = {};
        this.intervalSec = 2;
    }

    /**
     * Opens an account by setting the address
     * @param {string} address - Account address
     */
    open(address) {
        if (!address || typeof address !== 'string') {
            throw new Error('Invalid address format');
        }
        this.address = address;
    }

    /**
     * Updates the account's Nonce by querying the network
     * @returns {boolean} True if successful, false otherwise
     */
    async updateAccount() {
        if (!this.address) {
            throw new Error('Account is not open');
        }

        const data = {
            Blockchain: HexFix(this.blockchain),
            Address: HexFix(this.address),
            Version: this.codeVersion,
        };

        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(this.NAG_URL + 'Circular_GetWalletNonce_' + this.NETWORK_NODE);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80, // Default to 80 if no port is specified
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const jsonResponse = JSON.parse(body);
                        if (jsonResponse.Result === 200 && jsonResponse.Response && jsonResponse.Response.Nonce !== undefined) {
                            this.Nonce = jsonResponse.Response.Nonce + 1;
                            resolve(true);
                        } else {
                            reject(new Error('Invalid response format or missing Nonce field'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error in updateAccount:', error.message);
                resolve(false);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }

    /**
     * Sets the blockchain network
     * @param {string} network - Network name (e.g., 'devnet', 'testnet', 'mainnet')
     */
    async setNetwork(network) {
        return new Promise((resolve, reject) => {
            const nagUrl = NETWORK_URL + encodeURIComponent(network);
            const parsedUrl = url.parse(nagUrl);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80,
                path: parsedUrl.path,
                method: 'GET',
                headers: { Accept: 'application/json' },
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (data.status === 'success' && data.url) {
                            this.NAG_URL = data.url;
                            resolve();
                        } else {
                            reject(new Error(data.message || 'Failed to get URL'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error fetching network URL:', error.message);
                reject(error);
            });

            req.end();
        });
    }

    /**
     * Sets the blockchain address
     * @param {string} chain - Blockchain address
     */
    setBlockchain(chain) {
        this.blockchain = chain;
    }

    /**
     * Closes the account and resets all fields
     */
    close() {
        this.address = null;
        this.publicKey = null;
        this.info = null;
        this.lastError = '';
        this.NAG_URL = DEFAULT_NAG;
        this.NETWORK_NODE = '';
        this.blockchain = DEFAULT_CHAIN;
        this.LatestTxID = '';
        this.data = {};
        this.intervalSec = 2;
    }

    /**
     * Signs data using the account's private key
     * @param {string} data - Data to sign
     * @param {string} privateKey - Private key associated with the account
     * @returns {string} Signature
     */
    signData(data, privateKey) {
        if (!this.address) {
            throw new Error('Account is not open');
        }

        const ecInstance = new ec('secp256k1');
        const key = ecInstance.keyFromPrivate(HexFix(privateKey), 'hex');
        const msgHash = sha256(data).toString('hex');
        const signature = key.sign(msgHash).toDER('hex');
        return signature;
    }

    /**
     * Submits a certificate to the blockchain
     * @param {string} pdata - Data to submit
     * @param {string} privateKey - Private key associated with the account
     * @returns {Promise<Object>} Response from the blockchain
     */
    async submitCertificate(pdata, privateKey) {
        if (!this.address) {
            throw new Error('Account is not open');
        }

        const PayloadObject = {
            Action: 'CP_CERTIFICATE',
            Data: stringToHex(pdata),
        };

        const jsonstr = JSON.stringify(PayloadObject);
        const Payload = stringToHex(jsonstr);
        const Timestamp = getFormattedTimestamp();
        const str = HexFix(this.blockchain) + HexFix(this.address) + HexFix(this.address) + Payload + this.Nonce + Timestamp;
        const ID = sha256(str).toString('hex');
        const Signature = this.signData(ID, privateKey);

        const data = {
            ID,
            From: HexFix(this.address),
            To: HexFix(this.address),
            Timestamp,
            Payload: String(Payload),
            Nonce: String(this.Nonce),
            Signature,
            Blockchain: HexFix(this.blockchain),
            Type: 'C_TYPE_CERTIFICATE',
            Version: this.codeVersion,
        };

        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(this.NAG_URL + 'Circular_AddTransaction_' + this.NETWORK_NODE);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error in submitCertificate:', error.message);
                resolve({ success: false, message: 'Server unreachable or request failed', error: error.toString() });
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }

        
    /**
     * Polls for transaction outcome
     * @param {string} TxID - Transaction ID
     * @param {number} timeoutSec - Timeout in seconds
     * @returns {Promise<Object>} Transaction outcome
     */
    async GetTransactionOutcome(TxID, timeoutSec) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = this.intervalSec * 1000;
            const timeout = timeoutSec * 1000;

            const checkTransaction = async () => {
                const elapsedTime = Date.now() - startTime;

                if (elapsedTime > timeout) {
                    reject(new Error('Timeout exceeded'));
                    return;
                }

                try {
                    const data = await this.getTransactionbyID(TxID, 0, 10);
                    if (data.Result === 200 && data.Response !== 'Transaction Not Found' && data.Response.Status !== 'Pending') {
                        resolve(data.Response);
                    } else {
                        setTimeout(checkTransaction, interval);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            setTimeout(checkTransaction, interval);
        });
    }

    /**
     * Searches for a transaction by its ID
     * @param {string} TxID - Transaction ID
     * @param {number} Start - Starting block
     * @param {number} End - End block
     * @returns {Promise<Object>} Transaction details
     */
 async getTransactionbyID(TxID, Start, End) {
        const data = {
            Blockchain: HexFix(this.blockchain),
            ID: HexFix(TxID),
            Start: String(Start),
            End: String(End),
            Version: this.codeVersion,
        };

        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(this.NAG_URL + 'Circular_GetTransactionbyID_' + this.NETWORK_NODE);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error in getTransactionbyID:', error.message);
                reject(error);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }

}

// Export classes for use in other modules
module.exports = { C_CERTIFICATE, CEP_Account };
