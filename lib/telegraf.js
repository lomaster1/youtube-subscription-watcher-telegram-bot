const config = require("../config");
const Telegraf = require('telegraf'); //http://telegraf.js.org/

const app = new Telegraf(config.telegramApiKey);

// Set telegram webhook
let cert = null;
if (config.publicCert) {
    cert = {
        source: config.publicCert
    };
}
app.telegram.setWebhook(config.webHookUrl + '/' + config.webHookSecretPath, cert);

module.exports = app;