// __test__/esm/index.test.mjs

import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import elliptic from 'elliptic';
import sha256 from 'sha256';
import { C_CERTIFICATE, CEP_Account } from '../../lib/index.js';

chai.use(chaiAsPromised);
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
          it('should store data as hex', () => {
              const testData   = "test data is a string";
              certificate.setData(testData);
              expect(certificate.data).to.equal(Buffer.from(testData, 'utf8').toString('hex'));
          });
        });

        describe('getData()', () => {
          it('should retrieve original data', () => {
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
          
          // To make this test pass, the stringToHex and hexToString functions in lib/index.js
          // need to be updated to use Buffer.from for proper UTF-8 handling.
          
          it('should correctly retrieve multi-byte unicode data', () => {
            const unicodeData = "你好世界 😊"; // Multi-byte Unicode characters
            certificate.setData(unicodeData);
            // This test will likely fail with the current stringToHex/hexToString implementation
            // as it does not correctly handle multi-byte UTF-8 encoding.
            // It expects the original string back.
            expect(certificate.getData()).to.equal(unicodeData);
          });
        });

        describe('getJSONCertificate()', () => {
          it('should return a valid JSON string', () => {
              certificate.setData("json test");
              certificate.previousTxID = "tx123";
              certificate.previousBlock = "block456";

              const jsonCert = certificate.getJSONCertificate();
              expect(jsonCert).to.be.a('string');
              const parsedCert = JSON.parse(jsonCert);

              expect(parsedCert).to.deep.equal({
                  "data": Buffer.from("json test", 'utf8').toString('hex'),
                  "previousTxID": "tx123",
                  "previousBlock": "block456",
                  "version": LIB_VERSION
              });
          });
        });
        
        describe('getCertificateSize()', () => {
          // TODO: find a more explicit way to accomplish this
          it('should return correct byte length', () => {
              certificate.setData("size test");
              certificate.previousTxID = "txIDForSize";
              certificate.previousBlock = "blockIDForSize";

              const jsonString = JSON.stringify({
                  "data": Buffer.from("size test", 'utf8').toString('hex'),
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

        // These are for cleaning up the test outputs due to the throws + logs in the library
        let originalConsoleError; // To store the original console.error
        let originalConsoleLog;   // To store the original console.log
        let capturedLogs;         // To store console messages logged during a test run

        beforeEach(() => {
            account = new CEP_Account();
            if (!nock.isActive()) nock.activate();
            nock.cleanAll();

            // Initialize capturedLogs for each test
            capturedLogs = [];

            // We suppress and capture console.error and console.log during tests
            // to allow for assertions on their output where the output is an
            // expected side effect, rather than just noise. This is distinct
            // from testing *thrown* errors, which are handled by `rejectedWith`.
            originalConsoleError = console.error;
            originalConsoleLog = console.log;

            console.error = (...args) => {
                capturedLogs.push({ type: 'error', args });
                // Optionally, call the original console.error if you still want to see them
                // originalConsoleError(...args);
            };
            console.log = (...args) => {
                capturedLogs.push({ type: 'log', args });
                // Optionally, call the original console.log if you still want to see them
                // originalConsoleLog(...args);
            };
        });

        afterEach(() => {
            nock.cleanAll();
            nock.restore();
            // Restore original console.error and console.log after each test
            console.error = originalConsoleError;
            console.log = originalConsoleLog;
            capturedLogs = []; // Clear logs for the next test run
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
            });

            it('should throw an error if API response indicates failure', async () => {
                nock(NETWORK_INFO_URL_BASE)
                    .get(NETWORK_INFO_PATH)
                    .query({ network: 'failednet' })
                    .reply(200, { status: 'error', message: 'Invalid network specified' });

                await expect(account.setNetwork('failednet')).to.be.rejectedWith(/Invalid network specified/);
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
                        const dataHex = payloadObject.Data.startsWith('0x') ? payloadObject.Data.slice(2) : payloadObject.Data;
                        expect(Buffer.from(dataHex, 'hex').toString('utf8')).to.equal(certData);
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
               expect(result.error).to.match(/Network response was not ok/i);
               expect(nock.isDone()).to.be.true;
           });


            it('should throw an error if account is not open', async () => {
                account.close();
                await expect(account.submitCertificate(certData, mockPrivateKey)).to.be.rejectedWith("Account is not open");
            });
        });

        describe('getTransactionOutcome()', () => {
            const txID = "pollTxID456"; // Common txID for these tests
            const shortTimeout = 3; // Default timeout for library function in these tests

            let specificBodyMatcher;

            beforeEach(() => {
                account.intervalSec = 1; // For faster polling in tests

                const cleanedBlockchain = account.blockchain.startsWith('0x') ? account.blockchain.slice(2) : account.blockchain;
                specificBodyMatcher = (body) => {
                    return body.ID === txID &&
                           body.Start === "0" && // GetTransactionOutcome internally uses 0
                           body.End === "10" &&  // GetTransactionOutcome internally uses 10
                           body.Blockchain === cleanedBlockchain &&
                           body.Version === LIB_VERSION;
                };
            });

            it('should resolve with transaction data if found and confirmed quickly', async function() {
                this.timeout((shortTimeout * 1000) + 2000); // Mocha timeout

                const confirmedResponsePayload = { id: txID, Status: "Confirmed", data: "some data" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };

                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, confirmedResponse);

                const outcome = await account.GetTransactionOutcome(txID, shortTimeout);
                expect(outcome).to.deep.equal(confirmedResponsePayload);
                expect(nock.isDone()).to.be.true;

                // Assert on captured console.log messages for informational output
                expect(capturedLogs.some(log =>
                    log.type === 'log' &&
                    log.args[0] === 'Checking transaction...' &&
                    log.args[1].elapsedTime !== undefined &&
                    log.args[1].timeout !== undefined
                )).to.be.true;
                expect(capturedLogs.some(log =>
                    log.type === 'log' &&
                    log.args[0] === 'Data received:' &&
                    log.args[1].Result === 200 &&
                    log.args[1].Response.Status === 'Confirmed'
                )).to.be.true;
            });

            it('should poll and resolve when transaction is confirmed after being pending', async function() {
                this.timeout((shortTimeout * 1000) + 3000); // Mocha timeout

                const pendingResponse = { Result: 200, Response: { id: txID, Status: "Pending" } };
                const confirmedResponsePayload = { id: txID, Status: "Confirmed", finalData: "final" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };

                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, pendingResponse) // 1st call: Pending
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, pendingResponse) // 2nd call: Pending
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .reply(200, confirmedResponse); // 3rd call: Confirmed

                const outcome = await account.GetTransactionOutcome(txID, shortTimeout + 2); // Give it a bit more time
                expect(outcome).to.deep.equal(confirmedResponsePayload);
                expect(nock.isDone()).to.be.true;

                // Assert on captured console.log messages for polling behavior
                const checkingLogs = capturedLogs.filter(log => log.type === 'log' && log.args[0] === 'Checking transaction...');
                const dataReceivedLogs = capturedLogs.filter(log => log.type === 'log' && log.args[0] === 'Data received:');
                const pollingLogs = capturedLogs.filter(log => log.type === 'log' && log.args[0] === 'Transaction not yet confirmed or not found, polling again...');

                expect(checkingLogs.length).to.be.at.least(3); // At least 3 checks
                expect(dataReceivedLogs.length).to.equal(3); // 3 data received logs
                expect(pollingLogs.length).to.equal(2); // 2 polling messages

                expect(dataReceivedLogs[0].args[1].Response.Status).to.equal('Pending');
                expect(dataReceivedLogs[1].args[1].Response.Status).to.equal('Pending');
                expect(dataReceivedLogs[2].args[1].Response.Status).to.equal('Confirmed');
            });

            it('should poll and resolve when transaction is confirmed after "Transaction Not Found"', async () => {
                const notFoundResponse = { Result: 200, Response: "Transaction Not Found" };
                const confirmedResponsePayload = { id: txID, Status: "Confirmed", finalData: "final" };
                const confirmedResponse = { Result: 200, Response: confirmedResponsePayload };

                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                    .reply(200, notFoundResponse) // First call
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`)
                    .reply(200, confirmedResponse); // Second call
                
                const outcome = await account.GetTransactionOutcome(txID, shortTimeout);
                expect(outcome).to.deep.equal(confirmedResponsePayload);
                expect(nock.isDone()).to.be.true;

                // Assert on captured console.log messages for "Transaction Not Found" followed by confirmation
                const dataReceivedLogs = capturedLogs.filter(log => log.type === 'log' && log.args[0] === 'Data received:');
                const pollingLogs = capturedLogs.filter(log => log.type === 'log' && log.args[0] === 'Transaction not yet confirmed or not found, polling again...');

                expect(dataReceivedLogs.length).to.equal(2);
                expect(pollingLogs.length).to.equal(1);

                expect(dataReceivedLogs[0].args[1]).to.equal('Transaction Not Found');
                expect(dataReceivedLogs[1].args[1].Response.Status).to.equal('Confirmed');

            }).timeout(5000); // Increased Mocha timeout for this test

            it('should reject if getTransactionbyID call fails during polling', async () => {
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, (body) => true) // Match any request body
                    .replyWithError('Network connection lost');

                // This test primarily asserts that the promise is rejected with the correct error.
                // The error is *thrown* by the function under test.
                await expect(account.GetTransactionOutcome(txID, shortTimeout)).to.be.rejectedWith('Network connection lost');

                // Optionally, assert on captured console.log messages that precede the rejection,
                // if they are considered part of the expected informational output.
                expect(capturedLogs.some(log =>
                    log.type === 'log' && // Note: It's console.log in lib/index.js line 539
                    log.args[0] === 'Error fetching transaction:' &&
                    log.args[1].message === 'Network connection lost'
                )).to.be.true;
            });

            it('should reject with "Timeout exceeded" if polling duration exceeds timeoutSec', async () => {
                // Simulate a transaction that is always pending, so it will eventually timeout
                const pendingResponse = { Result: 200, Response: { id: txID, Status: "Pending" } };
                nock(DEFAULT_NAG_BASE_URL)
                    .post(`${DEFAULT_NAG_PATH}Circular_GetTransactionbyID_`, specificBodyMatcher)
                    .times(Infinity) // Reply with pending indefinitely
                    .reply(200, pendingResponse);

                // This test primarily asserts that the promise is rejected with the correct error.
                // The 'Timeout exceeded' error is *thrown* (via reject) by the function under test.
                await expect(account.GetTransactionOutcome(txID, 1)).to.be.rejectedWith('Timeout exceeded'); // Set a very short timeout

                // Optionally, assert on the console.log messages that precede the timeout,
                // if they are considered part of the expected informational output.
                expect(capturedLogs.some(log =>
                    log.type === 'log' &&
                    log.args[0] === 'Timeout exceeded'
                )).to.be.true;
            }).timeout(5000); // Increase Mocha timeout for this test
        });
    });
});