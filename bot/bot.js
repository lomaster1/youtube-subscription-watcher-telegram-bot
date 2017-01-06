const {Extra, Markup} = require('telegraf');
const models = require('../models');
const youtube = require('../lib/youtube');
const crypt = require('../lib/crypt');
const simpleRouter = require('./router');

const SubscriptionsUpdater = require('./subs_updater');
const Reminder = require('./reminder');
const Settings = require('./settings');


function YouTubeNotificationBot(telegrafApp) {
    let me = this;
    me.telegrafApp = telegrafApp;

    me.settings = new Settings(me);

    me.reminder = new Reminder(me);
    me.reminder.start();

    me.subsUpdater = new SubscriptionsUpdater(me);
    me.subsUpdater.start();

    //me.sendVideoUrl('207010404', '207010404', 1234567890, 'message', 'ru');

    telegrafApp.hears('rtest', (ctx) => {
        me.sendVideoUrl(ctx.from.id, ctx.chat.id, 1234567890, 'message', ctx.state.userSettings.language);
    });

    telegrafApp.command('start', me.onStartCommand.bind(me));
    telegrafApp.command('stop', me.onStopCommand.bind(me));
    telegrafApp.command('auth', me.onAuthCommand.bind(me));
    telegrafApp.command('mysubs', me.onMySubsCommand.bind(me));
    telegrafApp.command('reminders', me.onShowRemindersCommand.bind(me));
    telegrafApp.command('tz', me.onTimezoneCommand.bind(me));
    telegrafApp.command('lang', me.onLangCommand.bind(me));
    telegrafApp.command('stats', me.onStaticticCommand.bind(me));
    telegrafApp.on('text', me.onText.bind(me));

    telegrafApp.on('callback_query', simpleRouter.middleware())
    simpleRouter.on('remind', me.onRemindCallback.bind(me));
    simpleRouter.on('addRemind', me.onAddRemindCallback.bind(me));
    simpleRouter.on('removeRemind', me.onRemoveRemindCallback.bind(me));
    simpleRouter.on('setlang', me.onChangeLangCallback.bind(me));
}

YouTubeNotificationBot.prototype = {
    onStartCommand(ctx) {
        return this.settings.selectLanguage(ctx, true);
    },
    onStopCommand(ctx) {
        const userId = ctx.from.id;
        return this.removeUser(userId);
    },
    onAuthCommand(ctx) {
        const lang = ctx.state.userSettings.language;
        const state = {
            userId: ctx.from.id,
            chatId: ctx.chat.id
        };
        const authUrl = youtube.generateAuthUrl(crypt.crypt(state));
        const title = L(lang, 'AUTH_LINK_TITLE');
        return ctx.replyWithMarkdown(`[${title}](${authUrl})`)
    },
    getAndSaveUserToken(stateEncoded, code) {
        return new Promise((resultResolve, resultReject) => {
            if (!stateEncoded) resultReject("State is empty.");
            if (!code) resultReject("Code is empty.");

            let state;
            try {
                state = crypt.decrypt(stateEncoded);
            } catch (err) {
                resultReject(`State decrypt error ${err}.`);
                return;
            }
            const userId = state.userId;
            const chatId = state.chatId;

            youtube.getTokens(code)
                .then(tokens => new Promise((resolve, reject) => {
                    if (tokens) {
                        resolve(tokens);
                    } else {
                        reject("Tokens is null");
                    }
                }))
                .then(tokens => {
                    return models.UserToken.update({ userId: userId }, {
                        userId: userId,
                        chatId: chatId,
                        tokens: tokens
                    }, { upsert: true })
                        .then(() => models.UserToken.findOne({ userId: userId }));
                })
                .then(userToken => this.subsUpdater.updateUserSubscriptions(userToken))
                .then(() => this.settings.getLanguage(userId))
                .then(lang => {
                    const message = L(lang, 'AUTH_TOKEN_SUCCESS');
                    resultResolve(`${message}. ${L(lang, 'PLEASE_CLOSE_WINDOW')}`);
                    return this.telegrafApp.telegram.sendMessage(chatId, message);
                })
                .then(() => {
                    console.log("New user inserted");
                }).catch((err) => {
                    resultReject(err);
                });

        });
    },
    onMySubsCommand(ctx) {
        const lang = ctx.state.userSettings.language;
        const userId = ctx.from.id;
        return models.UserSubscription.find({ userId: userId })
            .then(subs => {
                if (subs.length > 0) {
                    let message = '';
                    subs.forEach((sub, index) => {
                        message += `${index + 1}. <a href="https://www.youtube.com/channel/${sub.channelId}">${sub.channelTitle}</a>\n`
                    });
                    return ctx.reply(message, Extra.HTML(true).webPreview(false));
                } else {
                    return ctx.reply(L(lang, 'NO_SUBSCRIPTIONS'));
                }
            });
    },
    onText(ctx) {
        if (this.settings.isWaitTimezone()) {
            return this.settings.changeTimezone(ctx, ctx.message.text);
        } else {
            console.log(`Search by text: ${ctx.message.text}`);
            const userId = ctx.from.id;
            models.UserToken.findOne({ userId: userId })
                .then((userToken) => userToken.tokens.toJSON())
                .then((tokens) => {
                    youtube.create(tokens).search.list({
                        part: "snippet",
                        q: ctx.message.text,
                        maxResults: 5
                    }, (err, data) => {
                        if (err) {
                            return ctx.reply(`${L('en', 'ERROR')}: ${err}`);
                        }

                        let promises = data.items.map((item, index) => {
                            const kind = item.id.kind;
                            switch (kind) {
                                case 'youtube#channel':
                                    const channelId = item.id.channelId;
                                    return ctx.reply(`${index + 1}. https://www.youtube.com/channel/${channelId}`);
                                case 'youtube#playlist':
                                    const playlistId = item.id.playlistId;
                                    const title = item.snippet.title;
                                    const image = item.snippet.thumbnails.high.url;
                                    return ctx.replyWithPhoto(image, {
                                        caption: `${index + 1}. ${title} https://www.youtube.com/playlist?list=${playlistId}`
                                    });
                                case 'youtube#video':
                                    const videoId = item.id.videoId;
                                    return ctx.reply(`${index + 1}. https://www.youtube.com/watch?v=${videoId}`);
                                default:
                                    return Promise.resolve();
                            }
                        });
                        return Promise.all(promises);
                    });
                });
        }
    },
    onRemindCallback(ctx) {
        return this.reminder.showRemindValueButtons(ctx);
    },
    onShowRemindersCommand(ctx) {
        return this.reminder.list(ctx);
    },
    onAddRemindCallback(ctx) {
        return this.reminder.add(ctx);
    },
    onRemoveRemindCallback(ctx) {
        return this.reminder.remove(ctx);
    },
    onTimezoneCommand(ctx) {
        return this.settings.askWriteTimezone(ctx);
    },
    onLangCommand(ctx) {
        return this.settings.selectLanguage(ctx);
    },
    onChangeLangCallback(ctx) {
        let promise = this.settings.changeLanguage(ctx, ctx.state.lang);
        if (ctx.state.isStart) {
            promise = promise.then(() => this._sendWelcomeMessage(ctx));
        }
        return promise
    },
    onStaticticCommand(ctx) {
        const lang = ctx.state.userSettings.language;
        let promises = [];

        promises.push(models.UserToken.distinct('userId')
            .then(userIds => `${L(lang, 'USERS_COUNT')}: ${userIds.length}`)
        );
        promises.push(models.UserSubscription.distinct('channelId')
            .then(channelIds => `${L(lang, 'CHANNELS_COUNT')}: ${channelIds.length}`)
        );
        promises.push(models.UserReminder.count()
            .then(reminderCount => `${L(lang, 'REMINDERS_COUNT')}: ${reminderCount}`)
        );
        return Promise.all(promises)
            .then((counts) => ctx.reply(counts.join("\n")));
    },

    _sendWelcomeMessage(ctx) {
        const lang = ctx.state.userSettings.language;
        return ctx
            .reply(L(lang, 'START_MESSAGE'))
            .then(() => {
                return new Promise((resolve, reject) => {
                    // Без задержки ссылка аутентификации приходит раньше сообщения выше.
                    setTimeout(() => {
                        this.onAuthCommand(ctx)
                            .then(resolve)
                            .catch(reject);
                    }, 500);
                });
            })
            .then(() => {
                return new Promise((resolve, reject) => {
                    // Без задержки сообщение ниже приходит раньше сообщения выше.
                    setTimeout(() => {
                        this.onTimezoneCommand(ctx)
                            .then(resolve)
                            .catch(reject);
                    }, 500);
                });
            });
    },

    sendVideoUrl(userId, chatId, videoId, videoTitle, lang) {
        return this.reminder.sendVideoUrl(userId, chatId, videoId, videoTitle, lang)
            .catch(err => {
                if (err.code === 403 && err.message.indexOf('Bot was blocked by the user')) {
                    this.removeUser(userId);
                }
            });
    },

    removeUser(userId) {
        return Promise.all([
            models.UserToken.remove({ userId: userId }),
            models.UserSubscription.remove({ userId: userId }),
            models.UserReminder.remove({ userId: userId }),
            models.UserSettings.remove({ userId: userId })
        ]);
    }
};

module.exports = YouTubeNotificationBot;