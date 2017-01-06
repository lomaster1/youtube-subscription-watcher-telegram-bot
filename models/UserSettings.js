const mongoose = require('../lib/mongoose'); //http://mongoosejs.com/docs/guide.html
const Schema = mongoose.Schema;

const UserSettingsSchema = new Schema({
    userId: { type: String, index: true },
    timezone: { type: String, default: '+00:00' },
    language: { type: String, default: "en" }
});

module.exports = mongoose.model('UserSettings', UserSettingsSchema);
