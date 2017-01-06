const mongoose = require('../lib/mongoose'); //http://mongoosejs.com/docs/guide.html
const Schema = mongoose.Schema;

const UserReminderSchema = new Schema({
    userId: { type: String, index: true },
    chatId: String,
    videoId: String,
    //videoTitle: String,
    remind: Date
});

module.exports = mongoose.model('UserReminder', UserReminderSchema);
