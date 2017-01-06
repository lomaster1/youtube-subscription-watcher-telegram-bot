const Localizations = require('./localizations');

function L(lang, code, ...args) {
    return buildString(Localizations[code][lang], ...args);
}

function buildString() {
    var outString = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        outString = outString.replace(new RegExp("\\$\\[" + i + "\\]", "g"), arguments[i]);
    }
    return outString;
}

global.L = L;
module.exports = L;