const mongoose = require('../lib/mongoose'); //http://mongoosejs.com/docs/guide.html
const Schema = mongoose.Schema;

const ChannelUpdateInfoSchema = new Schema({
    channelId: { type: String, index: true },
    lastUpdate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChannelUpdateInfo', ChannelUpdateInfoSchema);
