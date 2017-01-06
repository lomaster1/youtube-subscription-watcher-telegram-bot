const config = require('../config');
const crypto = require('crypto');

module.exports = {
    crypt(data) {
        let json = JSON.stringify(data);
        const cipher = crypto.createCipher('aes192', config.authStateSecret);
        let encrypted = cipher.update(json, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    },
    decrypt(encrypted) {
        const decipher = crypto.createDecipher('aes192', config.authStateSecret);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
}