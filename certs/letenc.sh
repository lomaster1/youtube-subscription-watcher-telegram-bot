# https://habrahabr.ru/post/317636/
# https://certbot.eff.org/#ubuntuxenial-other

letsencrypt certonly -n -d youtube-subs-watcher-bot.com -d youtube-subs-watcher-bot.4nmv.ru --email shamov-andrew@ya.ru --standalone --noninteractive --agree-tos
cp privkey.pem cert0.pem
cat fullchain.pem >> cert0.pem
