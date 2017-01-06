const config = require("../config");

const google = require("googleapis"); //https://www.npmjs.com/package/googleapis
const OAuth2 = google.auth.OAuth2;

function createOAuth2Client() {
    return new OAuth2(
        config.googleClientId,
        config.googleClientSecret,
        config.webHookUrl + "/oauth2callback"
    );
}

function generateAuthUrl(state) {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        approval_prompt: 'force', // чтобы получить refresh_token
        scope: ["https://www.googleapis.com/auth/youtube.readonly"],
        state: state //передавать можно только строку.
    });
}

function getTokens(code) {
    return new Promise((resolve, reject) => {
        const oauth2Client = createOAuth2Client();
        oauth2Client.getToken(code, function (err, tokens) {
            if (!err) {
                resolve(tokens);
            } else {
                reject(err);
            }
        });
    });
}

function createYouTubeClient(tokens) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    return google.youtube({
        version: 'v3',
        auth: oauth2Client
    });
}

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function createSharedYouTubeClient() {
    let keys = config.googleSharedApiKeys;
    let r = rnd(0, keys.length - 1);
    return google.youtube({
        version: 'v3',
        auth: keys[r]
    });
}

module.exports = {
    generateAuthUrl: generateAuthUrl,
    getTokens: getTokens,
    create: createYouTubeClient,
    shared: createSharedYouTubeClient
}