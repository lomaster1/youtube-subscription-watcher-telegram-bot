const models = require('../models');
const youtube = require('../lib/youtube');
const {Extra, Markup} = require('telegraf');

const CHECK_NEW_VIDEO_INTERVAL = 2 * 3600000; //2 часа


let SubscriptionsUpdater = function (bot) {
    this._bot = bot;
};

SubscriptionsUpdater.prototype = {
    run() {
        return this.updateAllUserSubscriptions()
            .then(() => this.removeUnWatchedChannelInfos())
            .then(() => this.checkAllChannelsNewVideo());
    },
    start() {
        this.run();
        setInterval(() => {
            this.run();
        }, CHECK_NEW_VIDEO_INTERVAL);
    },

    // ----------------------------------------------------------------

    updateAllUserSubscriptions() {
        console.log('updateAllUserSubscriptions');
        return models.UserToken.find()
            .then(userTokens => {
                let promises = userTokens.map(userToken => {
                    return this.updateUserSubscriptions(userToken);
                });
                return Promise.all(promises);
            });
    },
    updateUserSubscriptions(userToken) {
        const userId = userToken.userId;
        const chatId = userToken.chatId;
        const tokens = userToken.tokens.toJSON();
        console.log('updateUserSubscriptions ' + userId);

        // Сначала всё удалим, потом получим подписки заново.
        return models.UserSubscription.remove({ userId: userId })
            .then(() => this.getUserSubscriptions(tokens))
            .then((data) => {

                let promises = data.items.map((item) => {
                    let channelId = item.snippet.resourceId.channelId;
                    let sub = new models.UserSubscription({
                        userId: userId,
                        chatId: chatId,
                        channelId: channelId,
                        channelTitle: item.snippet.title
                    });
                    sub.save();
                    return this.createChannelUpdateInfo(channelId);
                });
                return Promise.all(promises);

            });
    },
    getUserSubscriptions(tokens) {
        //TODO: Перенести в класс youtube
        return new Promise((resolve, reject) => {

            //https://developers.google.com/youtube/v3/docs/subscriptions/list
            youtube.create(tokens).subscriptions.list({
                "part": "snippet",
                "mine": true,
                "maxResults": 50
            }, (err, data) => {
                if (err) {
                    console.log(`subscriptions.list error: ${err}`);
                    reject(err);
                } else {
                    resolve(data);
                }
            });

        });
    },
    createChannelUpdateInfo(channelId) {
        console.log('createChannelUpdateInfo ' + channelId);
        // Добавляем новые каналы.
        return models.ChannelUpdateInfo.findOne({ channelId: channelId })
            .then(channelUpdateInfo => {
                if (!channelUpdateInfo) {
                    let newChannelUpdateInfo = new models.ChannelUpdateInfo({
                        channelId: channelId
                    });
                    newChannelUpdateInfo.save();
                }
                return Promise.resolve();
            });
    },
    // ----------------------------------------------------------------
    removeUnWatchedChannelInfos() {
        console.log('removeUnWatchedChannelInfos');
        return models.UserSubscription.distinct('channelId')
            .then(channelIds => {
                return models.ChannelUpdateInfo.remove({
                    channelId: {
                        $nin: channelIds
                    }
                });
            });
    },
    // ----------------------------------------------------------------
    checkAllChannelsNewVideo() {
        console.log('checkAllChannelsNewVideo');
        return models.UserSubscription.distinct('channelId')
            .then((channelIds) => {
                let promises = channelIds.map(channelId => {
                    return this.checkChannelNewVideo(channelId);
                });
                return Promise.all(promises);
            });
    },
    checkChannelNewVideo(channelId) {
        console.log('checkChannelNewVideo ' + channelId);
        return models.ChannelUpdateInfo.findOne({ channelId: channelId })
            .then(channelUpdateInfo => {
                return {
                    channelId: channelUpdateInfo.channelId,
                    publishedAfter: channelUpdateInfo.lastUpdate
                };
            })
            .then((params) => this.getNewVideos(params))
            .then(data => {

                let promises = data.items.reverse().map((video) => {
                    return this.notifyUsers(channelId, video);
                });
                return Promise.all(promises);

            }).then(() => {
                return models.ChannelUpdateInfo.findOneAndUpdate({
                    channelId: channelId
                }, {
                        lastUpdate: new Date(Date.now())
                    });
            });
    },
    getNewVideos(params) {
        //TODO: Перенести в класс youtube
        return new Promise((resolve, reject) => {
            // https://developers.google.com/youtube/v3/docs/search/list
            youtube.shared().search.list({
                part: 'snippet',
                channelId: params.channelId,
                type: 'video',
                maxResults: 50,
                order: 'date',
                publishedAfter: ISODateString(params.publishedAfter)
            }, (err, data) => {
                if (err) {
                    console.log(`youtube.shared().search.list error: ${err}`);
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    },
    notifyUsers(channelId, video) {
        const videoId = video.id.videoId;
        const videoTitle = video.snippet.title;
        console.log('notifyUsers ' + channelId);
        console.log(videoTitle, videoId);

        return models.UserSubscription.find({ channelId: channelId })
            .then((userSubscriptions) => {
                let promises = userSubscriptions.map(userSubscription => {
                    return this._bot.settings.getLanguage(userSubscription.userId)
                        .then(lang => {
                            return this.notifyUser(userSubscription.userId,
                                userSubscription.chatId, videoId, videoTitle, lang);
                        });
                });
                return Promise.all(promises);
            });
    },
    notifyUser(userId, chatId, videoId, videoTitle, lang) {
        return this._bot.sendVideoUrl(userId, chatId, videoId, videoTitle, lang);
    }
};

function ISODateString(d) {
    function pad(n) {
        return n < 10 ? '0' + n : n
    }

    return d.getUTCFullYear() + '-'
        + pad(d.getUTCMonth() + 1) + '-'
        + pad(d.getUTCDate()) + 'T'
        + pad(d.getUTCHours()) + ':'
        + pad(d.getUTCMinutes()) + ':'
        + pad(d.getUTCSeconds()) + 'Z'
}


module.exports = SubscriptionsUpdater;
