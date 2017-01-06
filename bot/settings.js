const models = require('../models');
const moment = require('moment'); // http://momentjs.com/docs/
const {Extra, Markup} = require('telegraf');

let Settings = function (bot) {
    this._bot = bot;

    // Настройки пользователя middleware
    bot.telegrafApp.use(this.middleware());

    this._isWaitTimezone = false;
};

Settings.prototype = {
    middleware() {
        return (ctx, next) => {
            if (ctx && ctx.from) {
                this._getUserSettings(ctx.from.id)
                    .then(userSettings => {
                        ctx.state.userSettings = userSettings;
                        return next();
                    })
                    .catch(err => {
                        console.log(`User settings middleware error: ${err}`);
                        return next();
                    })
            } else {
                ctx.state.userSettings = new models.UserSettings();
                next();
            }
        };
    },
    askWriteTimezone(ctx) {
        this._isWaitTimezone = true;
        const lang = ctx.state.userSettings.language;
        return ctx.reply(L(lang, "ASK_TIMEZONE"));
    },
    changeTimezone(ctx, timezone) {
        this._isWaitTimezone = false;

        let tz = '+0000';

        const tz_parts = timezone.split(':');
        let h = parseInt(tz_parts[0], 10);
        if (!isNaN(h)) {
            tz = (h > 0 ? '+' : '-');
            h = Math.abs(h);
            tz += (h < 10 ? '0' + h : h);
            if (tz_parts.length === 1) {
                tz += '00';
            } else {
                const m = parseInt(tz_parts[1], 10);
                if (!isNaN(m)) {
                    m = Math.abs(m);
                    tz += (m < 10 ? '0' + m : m);
                } else {
                    tz += '00';
                }
            }
        }

        return this._changeUserSettings(ctx, tz, null)
            .then((userSettings) => {
                const lang = userSettings.language;
                const tz = userSettings.timezone;
                let d = moment().utcOffset(tz).locale(lang).format('L LT');
                return ctx.reply(L(lang, 'CHANGE_TIMEZONE_SUCCESS', d));
            });
    },
    isWaitTimezone() {
        return this._isWaitTimezone;
    },
    selectLanguage(ctx, isStart) {
        const lang = ctx.state.userSettings.language;
        const message = L(lang, 'ASK_CHANGE_LANGUAGE');
        return ctx.reply(message, Extra.markup(
            Markup.inlineKeyboard([
                Markup.callbackButton('English', 'setlang|en|' + (isStart ? '1' : '0')),
                Markup.callbackButton('Русский', 'setlang|ru|' + (isStart ? '1' : '0'))
            ])
        ));
    },
    changeLanguage(ctx, language) {
        return this._changeUserSettings(ctx, null, language)
            .then(userSettings => {
                const lang = userSettings.language;
                return ctx.reply(L(lang, 'CHANGE_LANGUAGE_SUCCESS'));
            });
    },
    _getUserSettings(userId) {
        let key = { userId: userId };
        return models.UserSettings.findOne(key)
            .then(userSettings => {
                if (!userSettings) {
                    return new models.UserSettings(key);
                }
                return userSettings;
            });
    },
    getLanguage(userId) {
        return this._getUserSettings(userId)
            .then((userSettings) => userSettings.language);
    },
    _changeUserSettings(ctx, timezone, language) {
        return this._getUserSettings(ctx.from.id)
            .then(userSettings => {
                if (timezone)
                    userSettings.set('timezone', timezone);
                if (language)
                    userSettings.set('language', language);
                return userSettings.save()
                    .then((userSettings) => ctx.state.userSettings = userSettings);
            });
    }
};

module.exports = Settings;