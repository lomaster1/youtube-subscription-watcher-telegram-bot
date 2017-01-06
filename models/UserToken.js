const mongoose = require('../lib/mongoose'); //http://mongoosejs.com/docs/guide.html
const Schema = mongoose.Schema;

const UserTokenSchema = new Schema({
    userId: { type: String, index: true },
    chatId: String,
    tokens: {
        access_token: String,
        refresh_token: String,
        token_type: String,
        expiry_date: Number
    }
});

module.exports = mongoose.model('UserToken', UserTokenSchema);
