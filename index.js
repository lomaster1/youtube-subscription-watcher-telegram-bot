const config = require('./config');
const telegrafApp = require('./lib/telegraf');
const expressApp = require('./lib/server');
const L = require('./lib/localize');
const YouTubeNotificationBot = require('./bot/bot');

const bot = new YouTubeNotificationBot(telegrafApp);

expressApp.use(telegrafApp.webhookCallback('/' + config.webHookSecretPath));

expressApp.get('/oauth2callback', function (req, res) {
    bot.getAndSaveUserToken(req.query.state, req.query.code)
        .then((message) => {
            res.send(`<h1>${message}</h1><script type="text/javascript">window.open('', '_self', ''); window.close();</script>`);
        })
        .catch((err) => res.send(`Error: ${err}`));
});

expressApp.listen(3000, () => {
    console.log('listening on port 3000!')
});
