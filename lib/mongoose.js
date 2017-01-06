const config = require("../config");
const mongoose = require('mongoose');

// Use native promises
mongoose.Promise = global.Promise;

mongoose.connect(config.mongodb);
mongoose.connection.on('error', console.error.bind(console, 'mongoose connection error:'));
mongoose.connection.once('open', function () {
    console.log("mongoose connected!");
});

module.exports = mongoose;