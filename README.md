# README #

Notify you about new YouTube video on your subscriptions. Also you can create reminder of it.

Умеет уведомлять о новых видео в твоих подписках на YouTube. Просмотр видео можно отложить и бот напомнит тебе о них.


Бот: ```@youtube_subs_watcher_bot```

### Подготовка к запуску ###

0. Лучше сделать своего бота и заменить API в ```config.json```, чтобы не мешать другим тестировать.

1. Установить [yarn](https://yarnpkg.com/) (если хочется)
2. Запустить ```yarn install``` или ```npm install```
3. Установить ```yarn global add localtunnel``` или ```npm install -g localtunnel```
4. Установить [mongodb](https://www.mongodb.com/download-center#community)

### Запуск ###

1. Запустить ```start_mongo.bat```
2. Запустить ```start_tunnel.bat```
3. Запустить ```start_bot.bat``` (тут через yarn). Можно запустить без Yarn ```npm run bot```

### Команды ###

```
auth - YouTube authentication
mysubs - Subscriptions list
reminders - Reminders list
tz - Change timezone
lang - Change language
stats - Statistics
```