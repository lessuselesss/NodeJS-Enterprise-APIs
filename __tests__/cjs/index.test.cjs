const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');
const elliptic = require('elliptic');
const sha256 = require('sha256');
const { C_CERTIFICATE, CEP_Account } = require('../../lib/index.js');

// Safely get the plugin function, handling potential default export wrapping
const chaiAsPromisedPlugin = typeof chaiAsPromised === 'object' && chaiAsPromised !== null && 'default' in chaiAsPromised
    ? chaiAsPromised.default
    : chaiAsPromised;

chai.use(chaiAsPromisedPlugin);
const { expect } = chai;

// Library's internal constants (for verification) from lib/index.js
const LIB_VERSION = '1.0.13';
const DEFAULT_NAG_BASE_URL = 'https://nag.circularlabs.io';
const DEFAULT_NAG_PATH = '/NAG.php?cep=';
const DEFAULT_NAG = `${DEFAULT_NAG_BASE_URL}${DEFAULT_NAG_PATH}`;
const DEFAULT_CHAIN = '0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2';
const NETWORK_INFO_URL_BASE = 'https://circularlabs.io';
const NETWORK_INFO_PATH = '/network/getNAG';


// Helper to generate a test key pair
const EC = elliptic.ec;
const ec = new EC('secp256k1');
const testKeyPair = ec.genKeyPair();
const testPrivateKey = testKeyPair.getPrivate('hex');
const testPublicKey = testKeyPair.getPublic('hex');
const testAccountAddress = '0x' + sha256(testPublicKey).substring(0, 40);

// Set the target network via an environment variable
// Example: "CIRCULAR_TEST_NETWORK=testnet mocha"
const targetNetwork = process.env.CIRCULAR_TEST_NETWORK;

// --- TEMPORARY HARDCODED NAG URLS FOR SPECIFIC NETWORKS ---
// This is a placeholder object. 
// 
// Ideally, setNetwork() should fetch the correct URLs.
// Once the `getNAG` service is fixed for the testnet/devnet networks, its entry here should be removed or set to null.
// Key: network name (e.g., 'testnet', 'devnet')
// Value: The actual distinct NAG URL for that network, or null if no override is needed/known.
const HARDCODED_NAG_URLS = {
    'testnet': 'https://testnet-nag.circularlabs.io/API/', // Replace null with 'https://actual-testnet-nag.circularlabs.io/API/' if known and needed
    'devnet': 'https://devnet-nag.circularlabs.io/API/',  // Replace null with 'https://actual-devnet-nag.circularlabs.io/API/' if known and needed
    // Add other networks here if they have similar issues and you know their correct distinct NAG URL.
};
// Example if you know the correct testnet URL and want to use it:
// const HARDCODED_NAG_URLS = {
//    'testnet': 'https://testnet-nag.circularlabs.io/API/',
//    'devnet': null,
// };

describe('Circular ESM Enterprise APIs', () => {

    describe('C_CERTIFICATE Class', () => {
        let certificate;

        beforeEach(() => {
            certificate = new C_CERTIFICATE();
        });

        it('should initialize with default values', () => {
            expect(certificate.data).to.be.null;
            expect(certificate.previousTxID).to.be.null;
            expect(certificate.previousBlock).to.be.null;
            expect(certificate.codeVersion).to.equal(LIB_VERSION);
        });

        describe('setData()', () => {
          it('should store data as hex (using librarys stringToHex)', () => {
              const testData = "test data is a string";
              certificate.setData(testData);
              let expectedHex = '';
              for (let i = 0; i < testData.length; i++) {
                const hex = testData.charCodeAt(i).toString(16);
                expectedHex += ('00' + hex).slice(-2);
              }
              expect(certificate.data).to.equal(expectedHex);
          });
        });

        describe('getData()', () => {
          it('should retrieve original data for simple strings', () => {
            const originalData = "another test";
            certificate.setData(originalData);
            expect(certificate.getData()).to.equal(originalData);
          });

          it('should return empty string if data is null or empty hex', () => {
            expect(certificate.getData()).to.equal('');
            certificate.data = '';
            expect(certificate.getData()).to.equal('');
          });

          it('should return empty string if data is "0x"', () => {
            certificate.data = '0x';
            expect(certificate.getData()).to.equal('');
          });

          // NOTE TO LIBRARY/SERVICE TEAM (UTF-8 Issue):
          // This test is expected to fail with the current library (lib/index.js) implementation.
          // The stringToHex and hexToString functions do not correctly handle multi-byte UTF-8.
          // They should be updated to use Buffer.from(str, 'utf8').toString('hex') and
          // Buffer.from(hex, 'hex').toString('utf8') respectively.
          it('should correctly retrieve multi-byte unicode data (EXPECTED TO FAIL WITH CURRENT LIBRARY)', () => {
            const unicodeData = "你好世界 😊";
            certificate.setData(unicodeData);
            expect(certificate.getData()).to.equal(unicodeData);
          });
        });

        describe('getJSONCertificate()', () => {
          it('should return a valid JSON string', () => {
              const testData = "json test";
              certificate.setData(testData);
              certificate.previousTxID = "tx123";
              certificate.previousBlock = "block456";

              const jsonCert = certificate.getJSONCertificate();
              expect(jsonCert).to.be.a('string');
              const parsedCert = JSON.parse(jsonCert);

              let expectedHexData = '';
              for (let i = 0; i < testData.length; i++) {
                const hex = testData.charCodeAt(i).toString(16);
                expectedHexData += ('00' + hex).slice(-2);
              }

              expect(parsedCert).to.deep.equal({
                  "data": expectedHexData,
                  "previousTxID": "tx123",
                  "previousBlock": "block456",
                  "version": LIB_VERSION
              });
          });
        });

        describe('getCertificateSize()', () => {
          it('should return correct byte length', () => {
              const testData = "size test";
              certificate.setData(testData);
              certificate.previousTxID = "txIDForSize";
              certificate.previousBlock = "blockIDForSize";

              let expectedHexData = '';
              for (let i = 0; i < testData.length; i++) {
                const hex = testData.charCodeAt(i).toString(16);
                expectedHexData += ('00' + hex).slice(-2);
              }

              const jsonString = JSON.stringify({
                  "data": expectedHexData,
                  "previousTxID": "txIDForSize",
                  "previousBlock": "blockIDForSize",
                  "version": LIB_VERSION
              });
              const expectedSize = Buffer.byteLength(jsonString, 'utf8');

              expect(certificate.getCertificateSize()).to.equal(expectedSize);
          });
        });
    });

    describe('CEP_Account Class', () => {
        let account;
        const mockAddress = testAccountAddress;
        const mockPrivateKey = testPrivateKey;

        let originalConsoleError;
        let originalConsoleLog;
        let capturedLogs;

        beforeEach(() => {
            account = new CEP_Account();
            if (!nock.isActive()) nock.activate();
            nock.cleanAll();

            capturedLogs = [];
            originalConsoleError = console.error;
            originalConsoleLog = console.log;

            console.error = (...args) => {
                capturedLogs.push({ type: 'error', args });
            };
            console.log = (...args) => {
                capturedLogs.push({ type: 'log', args });
            };
        });

        afterEach(() => {
            nock.cleanAll();
            nock.restore();
            console.error = originalConsoleError;
            console.log = originalConsoleLog;
            capturedLogs = [];
        });

        it('should initialize with default values', () => {
            expect(account.address).to.be.null;
            expect(account.publicKey).to.be.null;
            expect(account.info).to.be.null;
            expect(account.codeVersion).to.equal(LIB_VERSION);
            expect(account.lastError).to.equal('');
            expect(account.NAG_URL).to.equal(DEFAULT_NAG);
            expect(account.NETWORK_NODE).to.equal('');
            expect(account.blockchain).to.equal(DEFAULT_CHAIN);
            expect(account.LatestTxID).to.equal('');
            expect(account.Nonce).to.equal(0);
            expect(account.data).to.deep.equal({});
            expect(account.intervalSec).to.equal(2);
        });

        describe('open()', () => {
            it('should set the account address', () => {
                account.open(mockAddress);
                expect(account.address).to.equal(mockAddress);
            });

            it('should throw an error for invalid address format', () => {
                expect(() => account.open(null)).to.throw("Invalid address format");
                expect(() => account.open(123)).to.throw("Invalid address format");
                expect(() => account.open({})).to.throw("Invalid address format");
            });
        });

        describe('close()', () => {
            it('should reset account properties to defaults', () => {
                account.close();
                expect(account.address).to.be.null;
                expect(account.publicKey).to.be.null;
                expect(account.info).to.be.null;
                expect(account.lastError).to.equal('');
                expect(account.NAG_URL).to.equal(DEFAULT_NAG);
                expect(account.NETWORK_NODE).to.equal('');
                expect(account.blockchain).to.equal(DEFAULT_CHAIN);
                expect(account.LatestTxID).to.equal('');
                expect(account.Nonce).to.equal(0);
                expect(account.data).to.deep.equal({});
                expect(account.intervalSec).to.equal(2);
            });
        });

        describe('setBlockchain()', () => {
            it('should update the blockchain property', () => {
                const newChain = "0xmynewchain";
                account.setBlockchain(newChain);
                expect(account.blockchain).to.equal(newChain);
            });
        });

        describe('setNetwork()', () => {
            it('should update NAG_URL for "mainnet"', async () => {
                const expectedNewUrl = "https://mainnet-nag.circularlabs.io/API/";
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'mainnet' })
                    .reply(200, { status: 'success', url: expectedNewUrl });
                await account.setNetwork('mainnet');
                expect(account.NAG_URL).to.equal(expectedNewUrl);
                expect(nock.isDone()).to.be.true;
            });

            it('should update NAG_URL for "testnet"', async () => {
                const expectedNewUrl = "https://testnet-nag.circularlabs.io/API/";
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'testnet' })
                    .reply(200, { status: 'success', url: expectedNewUrl });

                await account.setNetwork('testnet');
                expect(account.NAG_URL).to.equal(expectedNewUrl);
                expect(nock.isDone()).to.be.true;
            });

            it('should update NAG_URL for "devnet"', async () => {
                const expectedNewUrl = "https://devnet-nag.circularlabs.io/API/";
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'devnet' })
                    .reply(200, { status: 'success', url: expectedNewUrl });

                await account.setNetwork('devnet');
                expect(account.NAG_URL).to.equal(expectedNewUrl);
                expect(nock.isDone()).to.be.true;
            });

            it('should throw an error if network request fails', async () => {
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'brokennet' })
                    .reply(500, "Server Error");

                await expect(account.setNetwork('brokennet')).to.be.rejectedWith(/HTTP error! status: 500/);
                expect(nock.isDone()).to.be.true;
            });

            it('should throw an error if API response indicates failure', async () => {
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'failednet' })
                    .reply(200, { status: 'error', message: 'Invalid network specified' });

                await expect(account.setNetwork('failednet')).to.be.rejectedWith(/Invalid network specified/);
                expect(nock.isDone()).to.be.true;
            });
        });

        describe('updateAccount()', () => {
            beforeEach(() => {
                account.open(mockAddress);
            });
            it('should update Nonce on successful API call', async () => {
                const mockApiResponse = { Result: 200, Response: { Nonce: 5 } };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetWalletNonce_`)
                    .reply(200, mockApiResponse);

                const result = await account.updateAccount();
                expect(result).to.be.true;
                expect(account.Nonce).to.equal(6);
                expect(nock.isDone()).to.be.true;
            });

            it('should return false and not update Nonce on API error (Result != 200)', async () => {
                const initialNonce = account.Nonce;
                const mockApiResponse = { Result: 400, Message: "Bad Request" };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetWalletNonce_`)
                    .reply(200, mockApiResponse);

                const result = await account.updateAccount();
                expect(result).to.be.false;
                expect(account.Nonce).to.equal(initialNonce);
                expect(nock.isDone()).to.be.true;
            });
             it('should return false on network error', async () => {
                const initialNonce = account.Nonce;
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetWalletNonce_`)
                    .replyWithError('Network failure');

                const result = await account.updateAccount();
                expect(result).to.be.false;
                expect(account.Nonce).to.equal(initialNonce);
                expect(nock.isDone()).to.be.true;
            });

            it('should throw an error if account is not open', async () => {
                account.close();
                await expect(account.updateAccount()).to.be.rejectedWith("Account is not open");
            });

            it('should return false if response is malformed (missing Nonce)', async () => {
                const initialNonce = account.Nonce;
                const mockApiResponse = { Result: 200, Response: { SomeOtherField: 5 } };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetWalletNonce_`)
                    .reply(200, mockApiResponse);

                const result = await account.updateAccount();
                expect(result).to.be.false;
                expect(account.Nonce).to.equal(initialNonce);
                expect(nock.isDone()).to.be.true;
            });
        });

        describe('signData()', () => {
            it('should sign data correctly', () => {
                account.open(mockAddress);
                const dataToSign = "sample data for signing";
                const signature = account.signData(dataToSign, mockPrivateKey);

                expect(signature).to.be.a('string');
                expect(signature.length).to.be.greaterThan(0);

                const key = ec.keyFromPublic(testPublicKey.startsWith('0x') ? testPublicKey.slice(2) : testPublicKey, 'hex');
                const msgHash = sha256(dataToSign);
                expect(key.verify(msgHash, signature)).to.be.true;
            });

            it('should throw an error if account is not open', () => {
                expect(() => account.signData("data", mockPrivateKey)).to.throw("Account is not open");
            });
            it('should produce different signatures for different data', () => {
                account.open(mockAddress);
                const sig1 = account.signData("data1", mockPrivateKey);
                const sig2 = account.signData("data2", mockPrivateKey);
                expect(sig1).to.not.equal(sig2);
            });

            it('should produce different signatures for different private keys', () => {
                account.open(mockAddress);
                const otherKeyPair = ec.genKeyPair();
                const otherPrivateKey = otherKeyPair.getPrivate('hex');
                const sig1 = account.signData("commondata", mockPrivateKey);
                const sig2 = account.signData("commondata", otherPrivateKey);
                expect(sig1).to.not.equal(sig2);
            });
        });

        describe('getTransaction() and getTransactionbyID()', () => {
            const txID = "testTxID123";
            const blockNum = 100;

            it('getTransaction(BlockID, TxID) should fetch a transaction', async () => {
                const mockResponse = { Result: 200, Response: { id: txID, status: "Confirmed" } };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                    .reply(200, mockResponse);

                const result = await account.getTransaction(blockNum, txID);
                expect(result).to.deep.equal(mockResponse);
                expect(nock.isDone()).to.be.true;
            });

            it('getTransaction(BlockID, TxID) should throw on network error', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                    .replyWithError('Network failure');

                await expect(account.getTransaction(blockNum, txID)).to.be.rejectedWith('Network failure');
                expect(nock.isDone()).to.be.true;
            });

            it('getTransactionbyID should fetch a transaction within a block range', async () => {
                const startBlock = 100;
                const endBlock = 110;
                const mockResponse = { Result: 200, Response: { id: txID, status: "Confirmed" } };

                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, (body) => {
                        const cleanedTxID = txID.startsWith('0x') ? txID.slice(2) : txID;
                        const cleanedBlockchain = account.blockchain.startsWith('0x') ? account.blockchain.slice(2) : account.blockchain;
                        return body.ID === cleanedTxID &&
                               body.Start === String(startBlock) &&
                               body.End === String(endBlock) &&
                               body.Blockchain === cleanedBlockchain &&
                               body.Version === LIB_VERSION;
                    })
                    .reply(200, mockResponse);

                const result = await account.getTransactionbyID(txID, startBlock, endBlock);
                expect(result).to.deep.equal(mockResponse);
                expect(nock.isDone()).to.be.true;
            });

            it('getTransactionbyID should handle "Transaction Not Found"', async () => {
                const mockResponse = { Result: 200, Response: "Transaction Not Found" };
                nock(DEFAULT_NAG_BASE_URL)
                   .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                   .reply(200, mockResponse);

               const result = await account.getTransactionbyID(txID, 0, 10);
               expect(result).to.deep.equal(mockResponse);
               expect(nock.isDone()).to.be.true;
           });

            it('getTransactionbyID should throw on network error', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                    .replyWithError('Network failure');

                await expect(account.getTransactionbyID(txID, 0, 10)).to.be.rejectedWith('Network failure');
                expect(nock.isDone()).to.be.true;
            });
        });

        describe('submitCertificate()', () => {
            const certData = "my certificate data";

            beforeEach(() => {
                account.open(mockAddress);
                account.Nonce = 1;
            });

            it('should submit a certificate successfully', async () => {
                const mockApiResponse = { Result: 200, TxID: "newTxID789", Message: "Transaction Added" };

                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_AddTransaction_`, (body) => {
                        const cleanedMockAddress = mockAddress.startsWith('0x') ? mockAddress.slice(2) : mockAddress;
                        const cleanedBlockchain = account.blockchain.startsWith('0x') ? account.blockchain.slice(2) : account.blockchain;

                        expect(body.From).to.equal(cleanedMockAddress);
                        expect(body.To).to.equal(cleanedMockAddress);
                        expect(body.Nonce).to.equal(String(account.Nonce));
                        expect(body.Type).to.equal('C_TYPE_CERTIFICATE');
                        expect(body.Blockchain).to.equal(cleanedBlockchain);

                        const payloadHex = body.Payload.startsWith('0x') ? body.Payload.slice(2) : body.Payload;
                        const payloadObject = JSON.parse(Buffer.from(payloadHex, 'hex').toString('utf8'));

                        expect(payloadObject.Action).to.equal("CP_CERTIFICATE");

                        let expectedPDataHex = '';
                        for (let i = 0; i < certData.length; i++) {
                            const hex = certData.charCodeAt(i).toString(16);
                            expectedPDataHex += ('00' + hex).slice(-2);
                        }
                        const dataHexInPayload = payloadObject.Data.startsWith('0x') ? payloadObject.Data.slice(2) : payloadObject.Data;
                        expect(dataHexInPayload).to.equal(expectedPDataHex);

                        return true;
                    })
                    .reply(200, mockApiResponse);

                const result = await account.submitCertificate(certData, mockPrivateKey);
                expect(result).to.deep.equal(mockApiResponse);
                expect(nock.isDone()).to.be.true;
            });

            it('should return error object on network failure', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                   .post(`${DEFAULT_NAG_PATH}Circular_AddTransaction_`)
                   .replyWithError('Simulated network error');

               const result = await account.submitCertificate(certData, mockPrivateKey);
               expect(result.success).to.be.false;
               expect(result.message).to.equal('Server unreachable or request failed');
               expect(result.error).to.contain('Simulated network error');
               expect(nock.isDone()).to.be.true;
           });

            it('should return error object on HTTP error status', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                   .post(`${DEFAULT_NAG_PATH}Circular_AddTransaction_`)
                   .reply(500, { message: "Internal Server Error" });

               const result = await account.submitCertificate(certData, mockPrivateKey);
               expect(result.success).to.be.false;
               expect(result.message).to.equal('Server unreachable or request failed');
               expect(result.error).to.match(/Error: Network response was not ok/i);
               expect(nock.isDone()).to.be.true;
           });


            it('should throw an error if account is not open', async () => {
                account.close();
                await expect(account.submitCertificate(certData, mockPrivateKey)).to.be.rejectedWith("Account is not open");
            });
        });

        describe('getTransactionOutcome()', () => {
             const txID = "pollTxID456";
            const shortTimeout = 3;
            let specificBodyMatcher;

            beforeEach(() => {
                account.intervalSec = 1;
                const cleanedBlockchain = account.blockchain.startsWith('0x') ? account.blockchain.slice(2) : account.blockchain;
                const cleanedTxID = txID.startsWith('0x') ? txID.slice(2) : txID;
                specificBodyMatcher = (body) => {
                    return body.ID === cleanedTxID &&
                           body.Start === "0" &&
                           body.End === "10" &&
                           body.Blockchain === cleanedBlockchain &&
                           body.Version === LIB_VERSION;
                };
            });

            it('should resolve with transaction data if found and confirmed quickly', async function() {
                this.timeout((shortTimeout * 1000) + 2000);
                const confirmedResponsePayload = { id: txID, Status: "Confirmed", data: "some data" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, confirmedResponse);
                const outcome = await account.GetTransactionOutcome(txID, shortTimeout);
                expect(outcome).to.deep.equal(confirmedResponsePayload);
            });

            it('should poll and resolve when transaction is confirmed after being pending', async function() {
                this.timeout((shortTimeout * 1000) + 4000);
                const pendingResponse = { Result: 200, Response: { id: txID, Status: "Pending" } };
                const confirmedResponsePayload = { id: txID, Status: "Confirmed", finalData: "final" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, pendingResponse)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, pendingResponse)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, confirmedResponse);
                const outcome = await account.GetTransactionOutcome(txID, shortTimeout + 2);
                expect(outcome).to.deep.equal(confirmedResponsePayload);
            });

            it('should poll and resolve when transaction is confirmed after "Transaction Not Found"', async function() {
                this.timeout(5000);
                const notFoundResponse = { Result: 200, Response: "Transaction Not Found" };
                const confirmedResponsePayload = { id: txID, Status: "Confirmed", finalData: "final" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, notFoundResponse)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, confirmedResponse);
                const outcome = await account.GetTransactionOutcome(txID, shortTimeout);
                expect(outcome).to.deep.equal(confirmedResponsePayload);
            });

            it('should reject if getTransactionbyID call fails during polling', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .replyWithError('Network connection lost');
                await expect(account.GetTransactionOutcome(txID, shortTimeout)).to.be.rejectedWith('Network connection lost');
            });

            it('should reject with "Timeout exceeded" if polling duration exceeds timeoutSec', async function() {
                this.timeout(5000);
                const pendingResponse = { Result: 200, Response: { id: txID, Status: "Pending" } };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .times(Infinity)
                    .reply(200, pendingResponse);
                await expect(account.GetTransactionOutcome(txID, 1)).to.be.rejectedWith('Timeout exceeded');
            });
        });

        // Tests for live network interactions ---
        // NOTE TO LIBRARY/SERVICE TEAM (REGARDING LIVE NAG URLS for `testnet`, `devnet`, etc.):
        // The `setNetwork(targetNetwork)` method relies on `NETWORK_URL` (https://circularlabs.io/network/getNAG)
        // to provide the correct NAG URL for the specified `targetNetwork`.
        //
        // Currently, for some non-mainnet environments (e.g., `testnet`), this service may return
        // the `DEFAULT_NAG` URL instead of a distinct URL for that specific environment.
        // For example, `curl "https://circularlabs.io/network/getNAG?network=testnet"`
        // currently returns `{"status":"success","url":"https://nag.circularlabs.io/NAG.php?cep=",...}`.
        //
        // This means live tests intended for such environments might inadvertently hit the default/mainnet NAG,
        // leading to failures (e.g., incorrect nonce, invalid signature for test accounts).
        //
        // RECOMMENDATION:
        // - The `getNAG` service should be updated to return distinct and operational NAG URLs
        //   for each supported non-mainnet environment (e.g., a unique URL for 'testnet',
        //   another for 'devnet', etc., like 'https://<network>-nag.circularlabs.io/API/').
        // - Until this is resolved, the live tests below may use a temporary hardcoding mechanism
        //   (via `HARDCODED_NAG_URLS`) to allow testing against known distinct NAG URLs if they exist,
        //   or they will reflect the current issue by using the URL provided by `getNAG`.
        if (targetNetwork) {
            describe(`CEP_Account Live Network Tests (against ${targetNetwork})`, function() {
                this.timeout(60000); // Default timeout for live tests in this suite

                let liveAccount;

                beforeEach(async () => {
                    liveAccount = new CEP_Account();
                    if (nock.isActive()) {
                        nock.restore();
                        nock.cleanAll();
                    }
                    console.error = originalConsoleError; // Restore real console for live logs
                    console.log = originalConsoleLog;

                    console.log(`Configuring account for real '${targetNetwork}' network via setNetwork()...`);
                    try {
                        await liveAccount.setNetwork(targetNetwork);
                    } catch (error) {
                        console.error(`Error during liveAccount.setNetwork('${targetNetwork}'):`, error);
                        // Decide if this should be a fatal error for the test suite
                        // For now, we'll proceed and let individual tests show the NAG_URL state.
                    }
                    const initialNagUrlFromSetNetwork = liveAccount.NAG_URL; // Capture what setNetwork provided

                    // --- Start of TEMPORARY HARDCODING block ---
                    const hardcodedUrlForTarget = HARDCODED_NAG_URLS[targetNetwork];
                    if (hardcodedUrlForTarget) {
                        console.warn(`[TEMPORARY OVERRIDE] Using hardcoded NAG_URL for '${targetNetwork}': ${hardcodedUrlForTarget}`);
                        liveAccount.NAG_URL = hardcodedUrlForTarget;
                    } else {
                        console.log(`No hardcoded NAG_URL override for '${targetNetwork}'. Using URL from setNetwork(): ${initialNagUrlFromSetNetwork}`);
                    }
                    // --- End of TEMPORARY HARDCODING block ---

                    liveAccount.open(testAccountAddress);
                    console.log(`Account NAG_URL for tests against '${targetNetwork}' is now: ${liveAccount.NAG_URL}`);
                });

                afterEach(() => {
                    if (!nock.isActive()) {
                        nock.activate();
                    }
                    if (liveAccount) liveAccount.close();
                });

                it('should update account nonce on real network', async () => {
                    const success = await liveAccount.updateAccount();
                    expect(success, `updateAccount failed for '${targetNetwork}'. NAG_URL was: ${liveAccount.NAG_URL}. Check if this is the correct NAG.`).to.be.true;
                    expect(liveAccount.Nonce).to.be.greaterThan(0);
                });

                it('should submit a certificate and get its outcome on real network', async function() {
                    this.timeout(120000); // Longer timeout for submit + poll

                    const updateSuccess = await liveAccount.updateAccount();
                    if (!updateSuccess) {
                        console.warn(`Could not update account nonce for '${targetNetwork}' before submitting certificate. Current Nonce: ${liveAccount.Nonce}. This might cause submission failure.`);
                    }

                    const certData = `Test data for ${targetNetwork} - ${new Date().toISOString()}`;
                    const privateKey = testPrivateKey;

                    console.log(`Attempting to submit certificate to ${targetNetwork} with Nonce ${liveAccount.Nonce} via NAG: ${liveAccount.NAG_URL}...`);
                    const submitResult = await liveAccount.submitCertificate(certData, privateKey);

                    const expectedApiSuccessCode = 200; // Adjust if API uses different success code
                    expect(submitResult.Result, `Submission failed for '${targetNetwork}'. API Result: ${submitResult.Result}, Response: "${submitResult.Response}", TxID: "${submitResult.TxID}". NAG_URL was: ${liveAccount.NAG_URL}.`).to.equal(expectedApiSuccessCode);
                    expect(submitResult.TxID).to.be.a('string').and.not.be.empty;
                    console.log(`Certificate submitted to '${targetNetwork}'. TxID: ${submitResult.TxID}. Waiting for outcome...`);

                    const txID = submitResult.TxID;
                    const outcomeTimeout = 60; // seconds

                    const outcome = await liveAccount.GetTransactionOutcome(txID, outcomeTimeout);
                    expect(outcome).to.not.be.null;
                    expect(outcome.Status).to.equal('Confirmed');
                    // The API might return the TxID without '0x', so clean the original for comparison if needed
                    const cleanedOriginalTxID = txID.startsWith('0x') ? txID.slice(2) : txID;
                    const cleanedOutcomeTxID = outcome.id && outcome.id.startsWith('0x') ? outcome.id.slice(2) : outcome.id;
                    expect(cleanedOutcomeTxID).to.equal(cleanedOriginalTxID);
                    console.log(`Transaction outcome confirmed for TxID: ${txID} on '${targetNetwork}'`);
                });

                it('should fetch a transaction by ID on real network', async function() {
                    this.timeout(60000);
                    console.log(`Attempting to fetch a transaction by ID on '${targetNetwork}' via NAG: ${liveAccount.NAG_URL}...`);
                    // IMPORTANT: Replace with an actual TxID known to exist on the `targetNetwork`
                    // accessible via the `liveAccount.NAG_URL` being used for this test run.
                    const txIDToFetch = "0xYOUR_KNOWN_TX_ID_ON_THIS_NAG";
                    const startBlock = 0;
                    const endBlock = 1000000; // Large recent range

                    if (txIDToFetch === "0xYOUR_KNOWN_TX_ID_ON_THIS_NAG") {
                        console.warn("Skipping live getTransactionbyID test: Please replace placeholder with a real transaction ID valid for the current NAG_URL.");
                        this.skip();
                        return;
                    }

                    const txResult = await liveAccount.getTransactionbyID(txIDToFetch, startBlock, endBlock);
                    expect(txResult).to.not.be.null;
                    expect(txResult.Result).to.equal(200);
                    expect(txResult.Response).to.not.be.empty;
                    if (typeof txResult.Response === 'string') {
                        console.log(`Transaction fetch response from '${targetNetwork}': ${txResult.Response}`);
                        expect(txResult.Response, "Expected transaction to be found, not a string error like 'Transaction Not Found'.").to.not.equal("Transaction Not Found");
                    } else {
                        const expectedTxId = txIDToFetch.startsWith('0x') ? txIDToFetch.slice(2) : txIDToFetch;
                        const actualTxId = txResult.Response.id && txResult.Response.id.startsWith('0x') ? txResult.Response.id.slice(2) : txResult.Response.id;
                        expect(actualTxId).to.equal(expectedTxId);
                        console.log(`Transaction fetched from '${targetNetwork}': ${JSON.stringify(txResult.Response)}`);
                    }
                });

                it('should fetch a transaction by block number and ID on real network', async function() {
                    this.timeout(60000);
                    console.log(`Attempting to fetch a transaction by Block ID and TxID on '${targetNetwork}' via NAG: ${liveAccount.NAG_URL}...`);
                    // IMPORTANT: Replace placeholders with actual Block ID and a TxID within that block
                    // known to exist on the `targetNetwork` accessible via `liveAccount.NAG_URL`.
                    const blockIDToFetch = 12345; // Placeholder
                    const txIDToFetchInBlock = "0xYOUR_KNOWN_TX_ID_IN_THAT_BLOCK"; // Placeholder

                    if (txIDToFetchInBlock === "0xYOUR_KNOWN_TX_ID_IN_THAT_BLOCK" || blockIDToFetch === 12345) {
                        console.warn("Skipping live getTransaction test: Please replace placeholders with real Block ID and TxID valid for the current NAG_URL.");
                        this.skip();
                        return;
                    }

                    const txResult = await liveAccount.getTransaction(blockIDToFetch, txIDToFetchInBlock);
                    expect(txResult).to.not.be.null;
                    expect(txResult.Result).to.equal(200);
                    expect(txResult.Response).to.not.be.empty;
                     if (typeof txResult.Response === 'string') {
                        console.log(`Transaction fetch response from '${targetNetwork}': ${txResult.Response}`);
                        expect(txResult.Response, "Expected transaction to be found, not a string error like 'Transaction Not Found'.").to.not.equal("Transaction Not Found");
                    } else {
                        const expectedTxId = txIDToFetchInBlock.startsWith('0x') ? txIDToFetchInBlock.slice(2) : txIDToFetchInBlock;
                        const actualTxId = txResult.Response.id && txResult.Response.id.startsWith('0x') ? txResult.Response.id.slice(2) : txResult.Response.id;
                        expect(actualTxId).to.equal(expectedTxId);
                        console.log(`Transaction fetched from '${targetNetwork}': ${JSON.stringify(txResult.Response)}`);
                    }
                });

                it('should correctly reflect network URL configuration status', async function() {
                    this.timeout(30000);
                    console.log(`Verifying NAG_URL for '${targetNetwork}' (current effective value for test: ${liveAccount.NAG_URL})...`);

                    const hardcodedUrlForTarget = HARDCODED_NAG_URLS[targetNetwork];
                    const urlFromSetNetwork = new CEP_Account(); // Create a fresh account to see what setNetwork *would* do
                    try {
                        await urlFromSetNetwork.setNetwork(targetNetwork);
                    } catch (e) {/* ignore error for this check */}


                    if (hardcodedUrlForTarget) {
                        // If we are using a hardcoded URL, tests are running against it.
                        expect(liveAccount.NAG_URL).to.equal(hardcodedUrlForTarget);
                        console.log(`Tests are using a hardcoded NAG_URL for '${targetNetwork}': ${hardcodedUrlForTarget}`);
                        if (hardcodedUrlForTarget !== urlFromSetNetwork.NAG_URL) {
                            console.warn(`[MISMATCH] The hardcoded URL (${hardcodedUrlForTarget}) is different from what setNetwork() currently provides (${urlFromSetNetwork.NAG_URL}). This indicates getNAG service may need update for '${targetNetwork}'.`);
                        }
                        if (hardcodedUrlForTarget === DEFAULT_NAG && targetNetwork !== 'mainnet' /*assuming mainnet uses default*/) {
                             console.warn(`[INFO] The hardcoded URL for non-mainnet '${targetNetwork}' is the DEFAULT_NAG. This might not be a distinct environment.`);
                        } else if (hardcodedUrlForTarget !== DEFAULT_NAG) {
                             expect(hardcodedUrlForTarget.toLowerCase()).to.include(targetNetwork.toLowerCase(), `Hardcoded URL for ${targetNetwork} should ideally include network name.`);
                        }

                    } else {
                        // No hardcoding, liveAccount.NAG_URL is what setNetwork() provided.
                        // This part of the test will show the current state of getNAG service.
                        console.log(`No hardcoded NAG_URL for '${targetNetwork}'. Using URL from setNetwork(): ${liveAccount.NAG_URL}`);
                        if (liveAccount.NAG_URL === DEFAULT_NAG && targetNetwork !== 'mainnet' /*assuming mainnet uses default*/) {
                            console.warn(`[CURRENT CONFIG] For '${targetNetwork}', setNetwork() resulted in DEFAULT_NAG. This means getNAG service likely points '${targetNetwork}' to the default NAG.`);
                            // This is an observation, not necessarily a test failure unless you have specific expectations.
                            // If you expect a distinct URL, this setup is problematic.
                        } else if (liveAccount.NAG_URL !== DEFAULT_NAG) {
                            expect(liveAccount.NAG_URL.toLowerCase()).to.include(targetNetwork.toLowerCase(), `NAG_URL from setNetwork() for ${targetNetwork} should ideally include network name if distinct from default.`);
                        } else {
                            // It's mainnet or another network that correctly uses DEFAULT_NAG
                            expect(liveAccount.NAG_URL).to.equal(DEFAULT_NAG);
                        }
                    }
                    console.log(`Final effective NAG_URL for '${targetNetwork}' in this test run: ${liveAccount.NAG_URL}`);
                });
            });
        }
    });
});
