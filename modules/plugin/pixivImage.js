const logger2 = require('../logger2'); //日志功能
const config = require('../config');
const NodeCache = require('node-cache');
var axios = require("axios");

//针对用户qq号的延时
const cache = new NodeCache({
    stdTTL: 1 * 5
});
//针对qq群的延时
/*const cache2 = new NodeCache({
    stdTTL: 1 * 5
});*/
var deleteMsg = false;//自动删图
const admin = config.default.bot.admin; //发现套了一个default。。！
let whiteqq = config.default.bot.pixiv.whiteqq;
let whiteqq2 = false;

function pixivCheck(context, replyFunc, bot) {
    if (/^看看[Pp]站.?/i.test(context.message) || /^https:\/\/www\.pixiv\.net\/artworks\/.?/i.test(context.message) || /^https:\/\/pixiv\.net\/i\/.?/i.test(context.message)) {
        //let gid = context.group_id;
        let i = 0;  
        let uid = context.user_id;

        for (i = 0; i < whiteqq.length; i++) {
            if (context.user_id == whiteqq[i]) {
                whiteqq2 = true;
                break;
            }
        }
        if (whiteqq2 == false || uid != admin) {
            return;
        }
        if (context.user_id != null) {
            const cacheKeys = [`${uid}`]; //防止单个QQ快速刷回复
            if (cacheKeys.some(key => cache.has(key))) {
                return;
            }
            [uid].forEach((id, i) => id && cache.set(cacheKeys[i], true));
        }
        /*if (context.group_id != null) {
            let cacheKeys = [`${gid}`]; //防止这个群快速刷回复 
            if (cacheKeys.some(key => cache2.has(key))) {
                return;
            }
            [gid].forEach((id, i) => id && cache2.set(cacheKeys[i], true));
        }*/
        //logger2.info(admin);
        let pic_id = /\d+/.exec(context.message);
        if (pic_id != null) singleImage(pic_id[0], replyFunc, context, bot);
        return true;
    } else return false;
}

function checkImage(url) {
    return axios.get(url).then(res => parseInt(res.headers['content-length'])).catch(err => {
        return err.response
    });
}

function imageCQcode(pic_id) {
    return `[CQ:image,cache=0,file=https://pixiv.cat/${pic_id}.jpg]`;
}

async function singleImage(pic_id, replyFunc, context, bot) {
    let payload = "";
    let url = `https://pixiv.cat/${pic_id}.jpg`
    let res = await checkImage(url);
    let delete_flag = true;
    if (res.status == 404) {
        if (/這個作品ID中有/.test(res.data)) {
            let num_img = parseInt(/這個作品ID中有 (\d{1,2}) 張圖片/.exec(res.data)[1]);
            for (let i = 1; i < num_img + 1; i++) {
                url = `https://pixiv.cat/${pic_id}-${i}.jpg`
                res = await checkImage(url);
                if (res / 1024 / 1024 > 30) payload += "图太大发不出来，原图看这里" + url;
                else payload += imageCQcode(`${pic_id}-${i}`);
            }
        } else {
            payload = "图可能被删了";
            delete_flag = false;
        }
    }
    //res > 4194304
    else if (res / 1024 / 1024 > 30) {
        payload = "图太大发不出来，原图看这里" + url;
        delete_flag = false;
    } else payload = imageCQcode(pic_id);
    sender(replyFunc, context, payload, bot, delete_flag);
}

function sender(replyFunc, context, payload, bot, delete_flag) {
    replyFunc(context, payload).then(res => {
        if (deleteMsg && delete_flag && res && res.data && res.data.message_id)
            setTimeout(() => {
                bot('delete_msg', {
                    message_id: res.data.message_id,
                });
            }, 60 * 1000);
    })
        .catch(err => {
            logger2.error(`${new Date().toLocaleString()} [error]pixiv delete msg\n${err}`);
        });
}

module.exports = {
    pixivCheck
};