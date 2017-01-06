const {Router} = require('telegraf');

const simpleRouter = new Router((ctx) => {
    if (!ctx.callbackQuery.data) {
        return Promise.resolve()
    }
    const parts = ctx.callbackQuery.data.split('|')

    let state = {};
    switch (parts[0]) {
        case 'remind':
            state = {
                videoId: parts[1]
            };
            break;
        case 'addRemind':
            state = {
                videoId: parts[1],
                value: parts[2]
            };
            break;
        case 'removeRemind':
            state = {
                videoId: parts[1]
            };
            break;
        case 'setlang':
            state = {
                lang: parts[1],
                isStart: (parts[2] === '1')
            };
            break;
    }

    return Promise.resolve({
        route: parts[0],
        state: state
    })
});

module.exports = simpleRouter;