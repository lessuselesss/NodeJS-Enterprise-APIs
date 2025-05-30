import { expect } from 'chai';
import * as Circular from '../../lib/index.js';

// PURE (LOGIC) UNIT TESTS

describe('C_CERTIFICATE', () => {
  it('should set and get data correctly', () => {
    const cert = new Circular.C_CERTIFICATE();
    cert.setData('hello');
    expect(cert.getData()).to.equal('hello');
  });

  it('should return correct JSON structure', () => {

    // Create a new certificate instance
    const cert = new Circular.C_CERTIFICATE();

    // Set some data on the certificate
    cert.setData('test');

    // Set some properties on the certificate
    cert.previousTxID = 'prevTx';
    cert.previousBlock = 'prevBlock';
    cert.codeVersion = '1.0.0';

    // Get the JSON representation of the certificate
    const json = JSON.parse(cert.getJSONCertificate());

    // Assert that the JSON structure is correct
    expect(json).to.have.property('data');
    expect(json).to.have.property('previousTxID', 'prevTx');
    expect(json).to.have.property('previousBlock', 'prevBlock');
    expect(json).to.have.property('version', '1.0.0');
  });

  it('should return correct certificate size', () => {
    //
    const cert = new Circular.C_CERTIFICATE();
    cert.setData('sizeTest');
    cert.previousTxID = 'txid';
    cert.previousBlock = 'block';
    cert.codeVersion = '1.0.0';
    const json = cert.getJSONCertificate();
    const expectedSize = Buffer.byteLength(json, 'utf8');
    expect(cert.getCertificateSize()).to.equal(expectedSize);
  });
});

describe('CEP_Account (pure methods)', () => {
  it('should open with a valid address', () => {
    const acc = new Circular.CEP_Account();
    acc.open('0x123');
    expect(acc.address).to.equal('0x123');
  });

  it('should throw on open with invalid address', () => {
    const acc = new Circular.CEP_Account();
    expect(() => acc.open()).to.throw();
    expect(() => acc.open(123)).to.throw();
  });

  it('should set blockchain', () => {
    const acc = new Circular.CEP_Account();
    acc.setBlockchain('chainX');
    expect(acc.blockchain).to.equal('chainX');
  });

  it('should reset properties on close', () => {
    const acc = new Circular.CEP_Account();
    acc.open('0xabc');
    acc.publicKey = 'pub';
    acc.info = 'info';
    acc.lastError = 'err';
    acc.NAG_URL = 'url';
    acc.NETWORK_NODE = 'node';
    acc.blockchain = 'chain';
    acc.LatestTxID = 'txid';
    acc.data = { foo: 'bar' };
    acc.Nonce = 42;
    acc.intervalSec = 99;
    acc.close();
    expect(acc.address).to.be.null;
    expect(acc.publicKey).to.be.null;
    expect(acc.info).to.be.null;
    expect(acc.lastError).to.equal('');
    expect(acc.NAG_URL).to.be.a('string');
    expect(acc.NETWORK_NODE).to.equal('');
    expect(acc.blockchain).to.be.a('string');
    expect(acc.LatestTxID).to.equal('');
    expect(acc.data).to.deep.equal({});
    expect(acc.intervalSec).to.equal(2);
  });

  it('should sign data if account is open', () => {
    const acc = new Circular.CEP_Account();
    acc.open('0x123');
    // Use a random 32-byte hex string as a dummy private key
    const dummyPriv = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const sig = acc.signData('testdata', dummyPriv);
    expect(sig).to.be.a('string');
    expect(sig.length).to.be.greaterThan(0);
  });

  it('should throw when signing data if account is not open', () => {
    const acc = new Circular.CEP_Account();
    const dummyPriv = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(() => acc.signData('testdata', dummyPriv)).to.throw();
  });
});

// NETWORK-DEPENDENT TESTS (placeholders)
describe('Network-dependent methods', () => {
  it('should update account from network (integration/mocked test)', () => {
    // TODO: Add test with network mocking or integration setup
  });
  it('should submit certificate to network (integration/mocked test)', () => {
    // TODO: Add test with network mocking or integration setup
  });
  // ... more network-dependent tests as needed
});
