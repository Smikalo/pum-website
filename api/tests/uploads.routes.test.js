const request = require('supertest');
const app = require('../src/app');
describe('Upload Routes', () => {
    test('Exists', () => {
        expect(app).toBeDefined();
    });
});