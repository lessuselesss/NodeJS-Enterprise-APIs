import { expect } from 'chai';
import * as Circular from '../../lib/index.js';

describe('C_CERTIFICATE', () => {
  it('should set and get data correctly', () => {
    const cert = new Circular.C_CERTIFICATE();
    cert.setData('hello');
    expect(cert.getData()).to.equal('hello');
  });
});
