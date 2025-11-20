module.exports = {
    nanoid: (size = 21) => 'mock-id-' + Math.random().toString(36).substring(2, 9),
    customAlphabet: (alphabet, size) => () => 'mock-id'
};