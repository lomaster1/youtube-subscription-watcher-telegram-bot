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
                let p = Promise.resolve();

                userTokens.forEach(userToken => {
                    p = p.then(() => this.updateUserSubscriptions(userToken));
                });

                return p;
            });
    },
    updateUserSubscriptions(userToken) {
        const userId = userToken.userId;
        const chatId = userToken.chatId;
        const tokens = userToken.tokens.toJSON();
        console.log('updateUserSubscriptions ' + userId);

        return this.getUserSubscriptions(userId, tokens)
            .then((data) => {
                return models.UserSubscription.remove({ userId: userId })
                    .then(() => data);
            })
            .then((data) => {
                console.log(`${userId} subs count ${data.items.length}`);

                let p = Promise.resolve();

                data.items.forEach(item => {
                    p = p.then(() => {
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
                });

                return p;
            }).catch((err) => {
                console.log(`updateUserSubscriptions ${userId} error: ${err}`);
                return;
            });
    },
    getUserSubscriptions(userId, tokens) {
        //TODO: Перенести в класс youtube
        return new Promise((resolve, reject) => {

            //https://developers.google.com/youtube/v3/docs/subscriptions/list
            youtube.create(tokens).subscriptions.list({
                "part": "snippet",
                "mine": true,
                "maxResults": 50
            }, (err, data) => {
                if (err) {
                    console.log(`subscriptions.list error for user ${userId}: ${err}`);
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
                    console.log('new ChannelUpdateInfo ' + channelId);
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
                let p = Promise.resolve();
                channelIds.forEach(channelId => {
                    p = p.then(() => this.checkChannelNewVideo(channelId));
                });
                return p;
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

                let p = Promise.resolve();
                data.items.reverse().forEach((video) => {
                    p = p.then(() => this.notifyUsers(channelId, video));
                });
                return p;

            }).then(() => {
                return models.ChannelUpdateInfo.findOneAndUpdate({
                    channelId: channelId
                }, {
                        lastUpdate: new Date(Date.now())
                    });
            }).catch((err) => {
                console.log(`checkChannelNewVideo ${channelId} error: ${err}`);
                return;
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
                let p = Promise.resolve();
                userSubscriptions.forEach(userSubscription => {
                    p = p.then(() => this._bot.settings.getLanguage(userSubscription.userId))
                        .then(lang => {
                            return this.notifyUser(userSubscription.userId,
                                userSubscription.chatId, videoId, videoTitle, lang);
                        });
                });
                return p;
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
