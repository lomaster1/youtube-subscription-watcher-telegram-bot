const models = require('../models');
const youtube = require('../lib/youtube');
const moment = require('moment'); // http://momentjs.com/docs/
const {Extra, Markup} = require('telegraf'); //http://telegraf.js.org/


const CHECK_INTERVAL = 30 * 60000; //30 мин

const KEYBOARD_MODE = {
    REMIND: 1,
    DEFAULT: 2,
    MORNING: 3,
    DONT_REMIND: 4
};


let Reminder = function (bot) {
    this._bot = bot;
};

Reminder.prototype = {
    add(ctx) {
        const lang = ctx.state.userSettings.language;
        const tz = ctx.state.userSettings.timezone;
        const videoId = ctx.state.videoId;
        const value = ctx.state.value;

        let remind = moment().utcOffset(tz);
        switch (value) {
            case "evening":
                remind.hour(21).minute(30);
                break;
            case "tomorrow":
                remind.add(1, 'days').hour(7).minute(15);
                break;
            default:
                const hours = parseInt(value, 10);
                if (!isNaN(hours)) {
                    remind.add(hours, 'hours');
                } else {
                    remind = null;
                }
        }

        if (remind) {
            const key = {
                userId: ctx.from.id,
                videoId: videoId
            };
            const data = {
                userId: ctx.from.id,
                chatId: ctx.chat.id,
                videoId: videoId,
                remind: moment(remind).utc().toDate()
            };

            const d = remind.locale(lang).calendar().toLowerCase();
            return models.UserReminder.findOneAndUpdate(key, data, { upsert: true })
                .then(() => ctx.answerCallbackQuery(L(lang, 'REMIND_CREATE_SUCCESS', d)))
                .then(() => this.showCancelRemindButton(ctx, lang));
        } else {
            return ctx.answerCallbackQuery(L(lang, 'WRONG_REMINDER_VALUE'));
        }
    },
    remove(ctx) {
        const lang = ctx.state.userSettings.language;
        const chatId = ctx.chat.id;
        const videoId = ctx.state.videoId;
        return this._removeFromDb(chatId, videoId)
            .then(() => ctx.answerCallbackQuery(L(lang, 'REMINDER_REMOVE_SUCCESS')))
            .then(() => this.showRemindButton(ctx, lang));
    },
    list(ctx) {
        const lang = ctx.state.userSettings.language;
        const tz = ctx.state.userSettings.timezone;
        const userId = ctx.from.id;
        return models.UserReminder.find({ userId: userId })
            .then(reminders => {
                if (reminders.length > 0) {
                    let p = Promise.resolve();
                    reminders.forEach(reminder => {
                        const videoId = reminder.videoId;
                        const reminderAsStr = moment(reminder.remind).utcOffset(tz).locale(lang).calendar().toLowerCase();
                        const message = L(lang, 'REMINDER_ABOUT', reminderAsStr, `https://www.youtube.com/watch?v=${videoId}`);
                        p = p.then(() => {
                            return ctx.reply(message, Extra.markup(
                                Markup.inlineKeyboard([
                                    Markup.callbackButton(L(lang, 'DO_NOT_REMIND_ME'), `removeRemind|${videoId}`)
                                ])
                            ))
                        })
                    });
                    return p;
                } else {
                    return ctx.reply(L(lang, 'NO_REMINDERS'));
                }
            });
    },
    start() {
        this.run();
        setInterval(() => {
            this.run();
        }, CHECK_INTERVAL);
    },
    run() {
        return models.UserReminder.find({ remind: { $lt: moment().utc().toDate() } })
            .then(reminders => this._remindAll(reminders));
    },
    _remindAll(reminders) {
        let p = Promise.resolve();
        reminders.forEach((reminder) => {
            p = p.then(() => this._remind(reminder));
        });
        return p;
    },
    _remind(reminder) {
        const userId = reminder.userId;
        const chatId = reminder.chatId;
        const videoId = reminder.videoId;
        return this._bot.settings.getLanguage(userId)
            .then(lang => {
                const message = L(lang, "REMIND_ABOUT");
                return this.sendVideoUrl(userId, chatId, videoId, message, lang);
            })
            .then(() => this._removeFromDb(chatId, videoId))
    },
    _removeFromDb(chatId, videoId) {
        return models.UserReminder.remove({
            chatId,
            videoId
        });
    },
    sendVideoUrl(userId, chatId, videoId, message, lang) {
        let msg = (message ? `${message} ` : '');
        msg += `https://www.youtube.com/watch?v=${videoId}`;
        return this._bot.telegrafApp.telegram.sendMessage(chatId, msg, Extra.markup(
            Markup.inlineKeyboard([
                Markup.callbackButton(L(lang, 'REMIND'), `remind|${videoId}`)
            ])
        ));
    },
    showRemindButton(ctx) {
        const lang = ctx.state.userSettings.language;
        const videoId = ctx.state.videoId;
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            Markup.callbackButton(L(lang, 'REMIND'), `remind|${videoId}`)
        ]));
    },
    showRemindValueButtons(ctx) {
        const lang = ctx.state.userSettings.language;
        const videoId = ctx.state.videoId;
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            Markup.callbackButton(L(lang, 'TODAY_EVENING_AT', '21-22'), `addRemind|${videoId}|evening`),
            Markup.callbackButton(L(lang, 'TOMORROW_MORNING_AT', '7-8'), `addRemind|${videoId}|tomorrow`)
        ]));
    },
    showCancelRemindButton(ctx) {
        const lang = ctx.state.userSettings.language;
        const videoId = ctx.state.videoId;
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            Markup.callbackButton(L(lang, 'DO_NOT_REMIND_ME'), `removeRemind|${videoId}`)
        ]));
    },

    _getKeyboard(mode, lang) {
        let buttons = [];
        switch (mode) {
            case KEYBOARD_MODE.REMIND:
                break;
            case KEYBOARD_MODE.DEFAULT:
                break;
            case KEYBOARD_MODE.DONT_REMIND:
                break;
        }
        return Markup.inlineKeyboard(buttons);
    }

};

module.exports = Reminder;