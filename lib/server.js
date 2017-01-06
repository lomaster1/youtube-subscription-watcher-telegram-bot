const express = require("express");
const logger = require("morgan");
const serveStatic = require("serve-static");
const path = require('path');
const expressApp = express();

expressApp.use(logger('dev')); // выводим все запросы со статусами в консоль
expressApp.use(serveStatic(path.join(__dirname, "..", "public"))); // запуск статического файлового сервера, который смотрит на папку public/ (в нашем случае отдает index.html)

module.exports = expressApp;