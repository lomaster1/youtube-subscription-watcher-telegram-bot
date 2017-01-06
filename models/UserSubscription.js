const mongoose = require('../lib/mongoose'); //http://mongoosejs.com/docs/guide.html
const Schema = mongoose.Schema;

const UserSubscriptionSchema = new Schema({
    userId: { type: String, index: true },
    chatId: { type: String, index: true },
    channelId: { type: String, index: true },
    channelTitle: String
});

module.exports = mongoose.model('UserSubscription', UserSubscriptionSchema)
