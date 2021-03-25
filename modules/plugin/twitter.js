const logger2 = require('../logger2'); //日志功能

//const Axios = require('axios');
const axios = require('axios-https-proxy-fix');
/*
https://www.ucloud.cn/yun/106541.html
nodejs使用axios代理https失败的解决方案
*/
const mongodb = require('mongodb').MongoClient;
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);

//const HttpsProxyAgent = require("https-proxy-agent");
const fs = require('fs-extra');
const node_localStorage = require('node-localstorage');
const node_localStorage2 = node_localStorage.LocalStorage;
const wecab = new node_localStorage2('./wecab'); //插件是否连上机器人
const dayjs = require('dayjs');
const downloadx = require('../Downloadx'); //输入url，返回文件路径
const ClearDownloadx = require('../ClearDownloadx') //删除文件
const NodeCache = require('node-cache');
const translate = require('./translate');
//https://www.npmjs.com/package/level
const config = require('../config');
//const { exit } = require('process');//关闭nodejs进程

//logger2.log(config);
//针对用户qq号的延时
const cache = new NodeCache({
    stdTTL: 1 * 5
});
//针对qq群的延时
const cache2 = new NodeCache({
    stdTTL: 1 * 5
});
const PROXY_CONF = config.default.proxy; //发现套了一个default。。！
//const PROXY_CONF = require("../../config.json").proxy;
const DB_PORT = 27017;
const DB_PATH = "mongodb://127.0.0.1:" + DB_PORT;
const BEARER_TOKEN = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const PIC_MAX_SIZE = 30 * 1024 * 1024; //图片最大体积
const VID_MAX_SIZE = 100 * 1024 * 1024; //视频最大体积
//const MAX_SIZE = 4194304;
const OPTION_MAP = {
    "仅原创": "origin_only",
    "仅转发": "retweet_only",
    "包含转发": "include_retweet",
    "不要转发": "no_retweet",
    "包含回复": "include_reply",
    "不要回复": "no_reply",
    "只看图": "pic_only",
    "全部": "all",
    "提醒": "notice"
}
const POSTTYPE_MAP = {
    "origin_only": [1, 0, 0, 1],
    "retweet_only": [0, 1, 0, 0],
    "include_retweet": [1, 1, 0, 1],
    "no_retweet": [1, 0, 1, 1],
    "include_reply": [1, 0, 1, 1],
    "no_reply": [1, 1, 0, 1],
    "pic_only": [0, 0, 0, 1],
    "all": [1, 1, 1, 1]
}

//let axios = false;
let guest_token = "";
let cookie = "";
let connection = true;
var proxy2 = false;
let video3 = new Array();//视频链接临时储存
let temp2 = new Array(); //翻译文本临时储存
let suo = false; //防止下一次动作覆盖上一个动作
let replyFunc = (context, msg, at = false) => {
    //logger2.info("推特：" + msg)
};
if (PROXY_CONF.host.length > 0 && PROXY_CONF.port !== 0) {
    proxy2 = {
        host: PROXY_CONF.host,
        port: PROXY_CONF.port
    }
}

/*function setAgent() {
    if (PROXY_CONF.host.startsWith("http") && PROXY_CONF.port != 0) {
        axios = Axios.create({
            httpsAgent: new HttpsProxyAgent({
                hostname: PROXY_CONF.host,
                port: PROXY_CONF.port,
                protocol: /^https/.test(PROXY_CONF.host) ? "https" : "http"
            })
        });
    }
    else axios = Axios;
}*/

/** option转文本*/
function toOptNl(option) {
    let { post } = option;
    let opt_string = "";
    for (key in OPTION_MAP) {
        if (OPTION_MAP[key] == post) opt_string = key;
    }
    if (option.bbq == true) opt_string += "; 需要烤架";
    if (option.notice != undefined) opt_string += "; 更新时提醒:" + option.notice;
    return opt_string;
}

function opt_dict(post_option) {
    let [origin, retweet, reply, pic, cook] = POSTTYPE_MAP[post_option];
    return {
        "origin": origin,
        "retweet": retweet,
        "reply": reply,
        "pic": pic
    }
}

function twitterReply(replyMsg) {
    replyFunc = replyMsg;
}

/** 检查网络情况，如果连不上Twitter那后面都不用做了*/
function checkConnection() {
    return axios.get("https://twitter.com", {
        headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
        },
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        logger2.info(res.status);
        connection = (res.status == 200) ? true : false;
    })
        .catch(err => {
            try {
                logger2.error(new Date().toString() + ",twitter checkConnection error with" + " , " + JSON.stringify(err));
            } catch (error) {
                logger2.error(new Date().toString() + ",twitter checkConnection error with" + " , " + err);
            }
            return false;
        });
}

function firstConnect() {
    checkConnection().then(() => {
        if (!connection) {
            logger2.info(new Date().toString() + ",twitter无法连接，功能暂停");
        }
        else {
            getGuestToken();
            setTimeout(() => getCookie(), 1000); //cookie有时间限制
            /*let refresh = */setInterval(() => {
                cookie = "";
                guest_token = "";
                getGuestToken();
                setTimeout(getCookie, 1000);
            }, 1 * 60 * 60 * 1000);
        }
    });
}

function sizeCheck(url, model = true) { //true 图片 false 视频
    return axios({
        method: "GET",
        url: url,
        //是否启用代理访问推特
        proxy: proxy2,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36"
        },
        timeout: 15000
    }).then(res => {
        if (model == true) {
            return parseInt(res.headers["content-length"]) < PIC_MAX_SIZE ? true : ((res.headers["content-length"] / 1024 / 1024) + "MB"); //图片
        } else {
            return parseInt(res.headers["content-length"]) < VID_MAX_SIZE ? true : ((res.headers["content-length"] / 1024 / 1024) + "MB"); //视频
        }
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特0：" + url + "," + err);
        return "获取文件大小失败";
    });
}

function httpHeader() {
    return headers = {
        "origin": "https://twitter.com",
        "authorization": BEARER_TOKEN,
        "cookie": cookie,
        "x-guest-token": guest_token,
        "x-twitter-active-user": "yes",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-site": "same-site",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
        "accept": "application/json, text/plain, */*",
        "dnt": "1",
        // "accept-encoding" : "gzip, deflate, br",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "x-twitter-client-language": "zh-cn"
    }
}

/** 获取一个Guest Token*/
function getGuestToken() {
    if (!connection) return;
    let headers = httpHeader();
    delete headers.cookie;
    delete headers.guest_token;
    headers["Host"] = "api.twitter.com";
    axios({
        method: "POST",
        url: "https://api.twitter.com/1.1/guest/activate.json",
        headers: headers,
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        logger2.info("获取一个Guest Token:" + res.data.guest_token);
        guest_token = res.data.guest_token;
    }).catch(err => {
        try {
            logger2.info(new Date().toString() + ",推特1：" + JSON.stringify(err))
        } catch (error) {
            logger2.info(new Date().toString() + ",推特1：" + err);
        }
    })
}

/** 获取一个cookie，后面要用*/
function getCookie() {
    if (!connection) return;
    let headers = httpHeader();
    delete headers.cookie;
    delete headers.authorization;
    axios({
        method: "GET",
        url: "https://twitter.com/explore",
        headers: headers,
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        //logger2.info("cookie：" + JSON.stringify(res.data));
        let temp = "";
        let guest_id = ""; //expire 2 years
        let personalization_id = ""; //expire 2 years
        let ct0 = ""; //expire 1 day
        let twitter_sess = ""; //not necessary
        for (let i = 0; i < res.headers["set-cookie"].length; i++) {
            if (temp = /guest_id=.+?; /.exec(res.headers["set-cookie"][i])) guest_id = temp[0];
            else if (temp = /ct0=.+?; /.exec(res.headers["set-cookie"][i])) ct0 = temp[0];
            else if (temp = /personalization_id=.+?; /.exec(res.headers["set-cookie"][i])) personalization_id = temp[0];
            else if (temp = /(_twitter_sess=.+?);/.exec(res.headers["set-cookie"][i])) twitter_sess = temp[1];
        }
        cookie = `dnt=1; fm=0; csrf_same_site_set=1; csrf_same_site=1; gt=${guest_token}; ${ct0}${guest_id}${personalization_id}${twitter_sess}`;
        logger2.info("获取一个cookie:" + cookie);
    }) //.catch(err => logger2.error(new Date().toString() + ",twitter cookie设置出错，错误：" + err.response.status + "," + err.response.statusText));
        .catch(err => logger2.error(new Date().toString() + ",twitter cookie设置出错，错误：" + err));
}

/** 
 * 获取单条Twitter参考  
 * developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-lookup
 * @param {string} tweet_id_str 单条Tweet id
 * @returns {Promise} Tweet Object，如果错误，结果为false
 */
async function getSingleTweet(tweet_id_str) {
    return axios({
        method: 'GET',
        url: "https://api.twitter.com/1.1/statuses/show.json",
        headers: {
            "authorization": BEARER_TOKEN,
        },
        params: {
            "id": tweet_id_str,
            "include_entities": "true",
            "include_ext_alt_text": "true",
            "include_card_uri": "true",
            "tweet_mode": "extended",
            "include_ext_media_color": "true",
            "include_ext_media_availability": "true",
            "include_cards": "1",
            "cards_platform": "Web-12",
        },
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        /**
       rate-limit
rate-limit 限制了用户在一定时间内请求的次数，并且会在相对时间后重置，在twitter，这个时间是15分钟。
根据上文我们可以知道twitter是通过x-guest-token判断rate-limit的，在用户的每次请求所返回的header上都会有以下内容
x-rate-limit-limit: 180
x-rate-limit-remaining: 179
x-rate-limit-reset: 1567401449
很好理解对吧，https://api.twitter.com/1.1/application/rate_limit_status.json 这个文件详细说明了各个api的rate-limit。
不要以为你刷新了 guest-token 就不会受到限制，那只是说明你的请求还不够多
https://blog.ailand.date/2020/02/26/how-to-crawl-twitter/
        */
        logger2.info("getSingleTweet/x-rate-limit-limit: " + res.headers["x-rate-limit-limit"]);
        logger2.info("getSingleTweet/x-rate-limit-remaining: " + res.headers["x-rate-limit-remaining"]);
        logger2.info("getSingleTweet/x-rate-limit-reset: " + res.headers["x-rate-limit-reset"]);
        logger2.info(JSON.stringify(res.data));
        return res.data;
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特2：" + JSON.stringify(err.response.data));
        return false;
    });
}

/** 
 * 获取用户时间线，参考  
 * developer.twitter.com/en/docs/tweets/timelines/api-reference/get-statuses-user_timeline
 * @param {string} user_id 单条Tweet id
 * @param {number} count 获取数量，最大为200
 * @returns {Promise} 用户时间线，如果错误结果为false
 */
/*include_profile_interstitial_type=1
include_blocking=1
include_blocked_by=1
include_followed_by=1
include_want_retweets=1
include_mute_edge=1
include_can_dm=1
include_can_media_tag=1
skip_status=1
cards_platform=Web-12
include_cards=1
include_composer_source=true
include_ext_alt_text=true
include_reply_count=1
//tweet_mode=extended
include_entities=true
include_user_entities=true
include_ext_media_color=true
include_ext_media_availability=true
send_error_codes=true
simple_quoted_tweets=true
ext=mediaStats%2CcameraMoment
//count=${count}
//cursor=${cursor}"
*/
async function getUserTimeline(user_id, count = 20, include_rt = 0, include_rp = 0, since_id = "1") {
    //logger2.log(count);
    //logger2.log(include_rt);
    //logger2.log(exclude_rp);
    //logger2.log(since_id);
    //logger2.log(BEARER_TOKEN);
    // logger2.log(guest_token);
    return axios({
        method: 'GET',
        url: `https://twitter.com/i/api/2/timeline/profile/${user_id}.json`,
        headers: httpHeader(),
        params: {
            // screen_name : screen_name,
            "userId": user_id,
            "count": count,
            "include_tweet_replies": include_rp,
            "include_want_retweets": include_rt,
            "tweet_mode": "extended",
            "include_cards": "1",
            "cards_platform": "Web-12",
            "include_ext_alt_text": "true",
            "include_ext_media_color": "true",
            "include_ext_media_availability": "true",
            "include_entities": "true",
            "include_ext_alt_text": "true",
            "include_card_uri": "true",
            since_id: since_id
        },
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        logger2.info("twitter_userid  :" + user_id);
        logger2.info("getUserTimeline/x-rate-limit-limit: " + res.headers["x-rate-limit-limit"]);
        logger2.info("getUserTimeline/x-rate-limit-remaining: " + res.headers["x-rate-limit-remaining"]);
        logger2.info("getUserTimeline/x-rate-limit-reset: " + res.headers["x-rate-limit-reset"]);
        //logger2.info(JSON.stringify(res.data));
        let tweets = [];
        let user = res.data.globalObjects.users[user_id];
        for (let tweetid of Object.keys(res.data.globalObjects.tweets)) {
            let tweet = res.data.globalObjects.tweets[tweetid];
            tweet.user = {
                name: user.name,
                screen_name: user.screen_name,
                headpic: user.profile_image_url_https,
                pinned: user.pinned_tweet_ids_str
            };
            tweets.push(tweet);
        }
        tweets = tweets.sort((a, b) => { return (a.id_str > b.id_str) ? -1 : 1; });
        //logger2.info(JSON.stringify(tweets))
        return tweets;
    }).catch(err => {
        logger2.error(new Date().toString() + ",twitter getUserTimeline error:" + JSON.stringify(err.response.data));
        //{"message":"Internal error","code":131}
        //{"message":"Rate limit exceeded","code":88}
        //{"message":"Sorry, that page does not exist","code":34}
        return false;
    });
}

/** 
 * 使用name搜索用户，参考  
 * developer.twitter.com/en/docs/accounts-and-users/follow-search-get-users/api-reference/get-users-search  
 * 关于user object，参考  
 * developer.twitter.com/en/docs/tweets/data-dictionary/overview/user-object
 * @param {string} name 用户名称
 * @returns {Promise} user_object，如果没有或者错误会返回false
 */
async function searchUser(name) {
    let header = httpHeader();
    header["x-guest-token"] = guest_token;
    return axios({
        method: "GET",
        url: "https://api.twitter.com/1.1/users/search.json",
        headers: header,
        params: {
            "q": name,
            "count": 1,
        },
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        logger2.info("searchUser/x-rate-limit-limit: " + res.headers["x-rate-limit-limit"]);
        logger2.info("searchUser/x-rate-limit-remaining: " + res.headers["x-rate-limit-remaining"]);
        logger2.info("searchUser/x-rate-limit-reset: " + res.headers["x-rate-limit-reset"]);
        return res.data[0]
    }).catch(err => {
        logger2.info(new Date().toString() + ",twitter searchUser error：" + JSON.stringify(err.response.data));
        return false;
    })
}



/**
 * 增加订阅
 * @param {number} user Twitter用户 user_object
 * @param {string} option 偏好设置
 * @param {object} context
 */
function subscribe(user, option, context) {
    let uid = user.id_str;
    let group_id = context.group_id;
    let name = user.name;
    let username = user.screen_name;
    let tweet_id = user.status.id_str;
    let option_nl = toOptNl(option);

    mongodb(DB_PATH, { useUnifiedTopology: true }).connect().then(async mongo => {
        try {
            let twitter_db = mongo.db('bot').collection('twitter');
            let group_option = mongo.db('bot').collection('group_option');
            let twitter_local = await twitter_db.findOne({ uid: uid });

            if (twitter_local == null) {
                await twitter_db.insertOne({
                    uid: uid,
                    name: name,
                    username: username,
                    groups: [group_id],
                    tweet_id: tweet_id
                });
            }
            else {
                await twitter_db.updateOne(
                    {
                        _id: twitter_local._id
                    },
                    {
                        $addToSet:
                        {
                            groups: group_id
                        }
                    });
            }
            await group_option.updateOne(
                {
                    group_id: context.group_id
                },
                {
                    $set: {
                        [`twitter.${uid}`]: option
                    }
                },
                {
                    upsert: true
                });

            if (option.bbq === true) {
                const twe_sum = mongo.db('bot').collection('twe_sum');
                await twe_sum.updateOne({ group_id: context.group_id },
                    {
                        $setOnInsert: {
                            count: 0,
                            count_done: 0,
                            list: [],
                            today_all: [],
                            today_raw: [],
                            today_done: []
                        }
                    },
                    {
                        upsert: true
                    });
            }
            replyFunc(context, `已订阅${name}的Twitter，模式为${option_nl}`, true);
        }
        catch (err) {
            logger2.error(new Date().toString() + ":" + err + "twitter subscribe mongo error");
        }
        finally {
            mongo.close();
        }
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter subscribe error, uid= " + uid));
}

/**
 * 取消订阅
 * @param {string} name Twitter用户名
 * @param {object} context
 */
function unSubscribe(/*name,*/ uid, context) {
    const group_id = context.group_id;
    //let name_reg = new RegExp(name, 'i');

    mongodb(DB_PATH, { useUnifiedTopology: true }).connect().then(async mongo => {
        const twitter_db = mongo.db('bot').collection('twitter');
        twitter_db.findOneAndUpdate({
            uid: uid,
            //name: name_reg
        },
            {
                $pull: {
                    groups: {
                        $in: [group_id]
                    }
                }
            },
            async (err, result) => {
                if (err) {
                    logger2.error(new Date().toString() + ",推特：" + err + ",database subscribes delete error");
                }
                else {
                    let text = "";
                    if (result.value == null || !result.value.groups.includes(group_id)) {
                        logger2.error(result.value, group_id);
                        replyFunc(context, "未发现任何推特订阅", true);
                        mongo.close();
                        return;
                    }
                    else {
                        let uid2 = result.value.uid;
                        let screen_name = result.value.name;
                        if (result.value.groups.length <= 1) await twitter_db.deleteOne({ _id: result.value._id });
                        const group_option = mongo.db('bot').collection('group_option');
                        group_option.findOneAndUpdate({
                            group_id: context.group_id
                        },
                            {
                                $unset: {
                                    [`twitter.${uid2}`]: ""
                                }
                            },
                            (err, result) => {
                                if (err) logger2.error(err + "\ngroup_option unset error");
                                else {
                                    text = "已取消订阅" + screen_name + "的Twitter";
                                    replyFunc(context, text, true);
                                }
                                mongo.close();
                            });
                    }
                    replyFunc(context, text, true);
                }
            });
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter unsubscribe error, uid= " + uid));
}

/**
 * 每过x分钟检查一次订阅列表，如果订阅一个Twitter账号的群的数量是0就删除
 */
async function checkTwiTimeline() {
    if (!connection) return;
    const mongo = await mongodb(DB_PATH, { useUnifiedTopology: true }).connect();
    const twitter_db = mongo.db('bot').collection('twitter');
    let subscribes = await twitter_db.find({}).toArray();
    let check_interval = subscribes.length > 0 ? subscribes.length * 30 * 1000 : 5 * 60 * 1000;
    mongo.close();
    let i = 0;

    async function refreshTimeline() {
        await mongodb(DB_PATH, { useUnifiedTopology: true }).connect().then(async mongo => {
            const twitter_db = mongo.db('bot').collection('twitter');
            const group_option = mongo.db('bot').collection('group_option');
            let subscribes = await twitter_db.find({}).toArray();
            let options = await group_option.find({}).toArray();

            if (subscribes.length > 0 && options.length > 0) {
                i = 0;
                check_interval = subscribes.length * 30 * 1000;
                setTimeout(refreshTimeline, check_interval + 30000);
                checkEach();
            }
            else if (subscribes.length < 1 || options.length < 1) {
                //logger2.error("twitter subs less than 1");
            }
            else if (subscribes == undefined || options == undefined) {
                subscribes = await twitter_db.find({}).toArray();
                subscribes != undefined ? checkEach() : logger2.error("twitter database error");
            }
            mongo.close();
            ClearDownloadx();
            function checkEach() {
                setTimeout(async () => {
                    process: try {
                        if (wecab.getItem("huozhe") == "false") {
                            logger2.info(new Date().toString() + ",连不上机器人，跳过订阅twitter"); //长时间连不上还是可能丢失信息的，因为消息源会更新覆盖旧的
                            return;
                        }
                        if (subscribes[i] == undefined) break process;
                        let ii = new Array();
                        let curr_s = subscribes[i];
                        let tweet_list = await getUserTimeline(curr_s.uid, 5, 1, 1);
                        if (tweet_list != undefined && tweet_list.length > 0 && tweet_list[0].id_str > curr_s.tweet_id) {
                            tweet_list = tweet_list.filter(t => t.id_str > curr_s.tweet_id);
                            let groups = curr_s.groups;
                            let url_list = [];
                            for (let group_id of groups) {//按群发送
                                let option = false;
                                let post = false;
                                for (let group of options) {
                                    if (group.group_id == group_id) {
                                        option = group.twitter[curr_s.uid];
                                        break;
                                    }
                                }
                                if (!option) throw `Twitter转发时出错，${group_id}这个组没有配置`;
                                else post = opt_dict(option.post);
                                for (let tweet of tweet_list) {
                                    let status = checkStatus(tweet);
                                    if (needPost(status, post)) {
                                        let url = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
                                        let addon = [];
                                        if (status != "retweet") {
                                            if (option.notice != undefined) addon.push(`${option.notice}`);
                                            url_list.push(url);
                                        }
                                        if (ii[group_id] == undefined) {
                                            ii[group_id] = 1;
                                        }
                                        addon.push(url);
                                        const context = { group_id: group_id, message_type: "group" };
                                        format(tweet, curr_s.uid, false, false, 0, context).then(payload => {
                                            payload = ii[context.group_id] + "\n" + payload;
                                            replyFunc(context, ii[group_id] + `, https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
                                            ii[context.group_id] = ii[context.group_id] + 1;
                                            if (video3[tweet.id_str.toString()] != undefined) {//视频
                                                replyFunc(context, video3[tweet.id_str.toString()]);
                                            }
                                            payload += `\n\n${addon.join("\n")}`
                                            replyFunc(context, payload);
                                        }).catch(err => logger2.error(new Date().toString() + ",推特6：" + err));
                                    }
                                }
                                video3 = null;
                                video3 = new Array();
                                //logger2.info("video3: " + video3);
                                temp2 = null;
                                temp2 = new Array();
                                //logger2.info("temp2: " + temp2);
                            }
                            //不好办啊
                            setTimeout(updateTwitter, 500, tweet_list, curr_s);//更新mongo数据库数据
                        }
                    } catch (err) {
                        logger2.error(new Date().toString() + ",推特：" + err + ',' + JSON.stringify(subscribes[i]));
                    } finally {
                        i++;
                        if (i < subscribes.length) {
                            checkEach();
                        } else {
                            video3 = null;
                            video3 = new Array();
                            //logger2.info("video3: " + video3);
                            temp2 = null; //处理最后一个推特会残留的机翻文本
                            temp2 = new Array();
                            //logger2.info("temp2: " + temp2);
                            suo = false;
                        }
                    }
                }, (check_interval - subscribes.length * 1000) / subscribes.length);
            }
        });
    }
    setTimeout(refreshTimeline, 5000);

    function checkStatus(tweet) {
        let status = "";
        if ("retweeted_status" in tweet || "retweeted_status_id_str" in tweet || /^RT @/.test(tweet.full_text)) status = "retweet";
        else if ("in_reply_to_status_id_str" in tweet && tweet.in_reply_to_status_id_str != null) status = "reply";
        else if ("media" in tweet.entities && tweet.entities.media[0].type == "photo") status = "pic";
        else status = "origin"

        return status;
    }

    function needPost(status, option) {
        switch (status) {
            case "origin": if (option.origin == 1) return true; break;
            case "reply": if (option.reply == 1) return true; break;
            case "retweet": if (option.retweet == 1) return true; break;
            case "pic": if (option.pic == 1) return true; break;
            default: return false;
        }
        return false;
    }

    function updateTwitter(tweet_list, subscribe) {
        mongodb(DB_PATH, { useUnifiedTopology: true }).connect().then(async mongo => {
            const twitter_db = mongo.db('bot').collection('twitter');
            await twitter_db.updateOne(
                { _id: subscribe._id },
                { $set: { tweet_id: tweet_list[0].id_str, name: tweet_list[0].user.name } })
                .then(result => {
                    if (result.result.ok != 1 && result.result.nModified < 1) {
                        logger2.error(tweet_list[0].id_str, subscribe.tweet_id, tweet_list[0].user.name,
                            result, "\n twitter_db update error during checkTwitter");
                    }
                })
                .catch(err => logger2.error(err + "\n twitter_db update error during checkTwitter"));
            mongo.close();
        });
    }
}

/**
 * 查看推特订阅列表
 * @param {object} context
 * @returns {} no return
 */
function checkSubs(context) {
    const group_id = context.group_id;
    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let TWI = mongo.db('bot').collection('twitter');
        const group_option = mongo.db('bot').collection('group_option');
        let matchs = await TWI.find({
            groups: {
                $in: [group_id]
            }
        }).toArray();
        let uid = matchs[0] != null ? matchs[0].uid : "";
        //logger2.info("twitter_db:" + uid);
        let options = await group_option.findOne({
            group_id: group_id
        });
        let subs = [];
        for (let sub in options.twitter) {
            let name = options.twitter[sub].name;
            let option_nl = toOptNl(options.twitter[sub]);
            subs.push(`${name}，推特用户id：${uid}，模式为${option_nl}`)
        }
        if (subs.length < 1) {
            replyFunc(context, "未找到该群有推特订阅", true);
        }
        else {
            replyFunc(context, `本群已订阅:\n${subs.join("\n")}`)
        }
        mongo.close();
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter checkWeiboSubs error, group_id= " + group_id));
}

/**
 * 清理XX群全部推特订阅列表
 * @param {object} context
 * @returns {} no return
 */
function clearSubs(context, group_id) {
    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        const TWI = mongo.db('bot').collection('twitter');
        const GROUP_OPTION = mongo.db('bot').collection('group_option');
        try {
            await GROUP_OPTION.updateOne({
                group_id: group_id
            },
                {
                    $set: {
                        twitter: {}
                    }
                });
            let matchs = await TWI.find({
                groups: {
                    $in: [group_id]
                }
            }).toArray();
            if (matchs.length < 1) {
                replyFunc(context, `未发现本期有Twitter订阅`);
                return;
            }
            for (let item of matchs) {
                let res = await TWI.findOneAndUpdate({ _id: item._id }, { $pull: { groups: { $in: [group_id] } } }, { returnOriginal: false });
                if (res.value.groups.length < 1) await TWI.deleteOne({ _id: res.value._id });
            }
            replyFunc(context, `清理了${matchs.length}个Twitter订阅`);
        }
        catch (err) {
            logger2.error(new Date().toString() + ",推特清理订阅：" + err);
            replyFunc(context, '中途错误，清理未完成');
        }
        finally {
            mongo.close();
        }
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter clearSubs error, group_id= " + group_id));
}

/**
 * 下载视频并发送
 * @param {string} url 视频链接
 * @param {object} context
 */
async function downloadvideo(url, context) {
    logger2.info("要发送的视频链接: " + url);
    try {
        replyFunc(context, `[CQ:video,cache=0,file=file:///${await downloadx(url, "video2", -1)},cover=file:///${__dirname}/black.jpg,c=3]`)
            .then(() => {
                logger2.info("发送视频完成");
            }).catch(err => {
                logger2.error(new Date().toString() + ",发送视频：" + err);
            });
    } catch (err) {

    } finally {
        suo = false;
    }
}


/**
 * 整理tweet_obj
 * @param {object} tweet Tweet object
 * @param {number} useruid 
 * @param {boolean} end_point 是否停止进一步挖掘
 * @param {boolean} retweeted 
 * @param {number} headpicshu1 
 * @param {object} context 用于发送的context
 * @returns Promise  排列完成的Tweet String
 */
async function format(tweet, useruid = -1, end_point = false, retweeted = false, headpicshu1 = 0, context = false) {
    if (!tweet) return "Twitter转发时错误";
    let payload = [];
    let text = "";
    let headpicshu2 = headpicshu1;
    if ('full_text' in tweet) text = tweet.full_text;
    else text = tweet.text;
    text = text.replace(/&amp;/g, "&").replace(/&#91;/g, "[").replace(/&#93;/g, "]").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    logger2.info("1");
    try {
        if ("retweeted_status" in tweet) {
            let rt_status = await format(tweet.retweeted_status, -1, false, true);
            payload.push(`来自${tweet.user.name}${useruid != -1 & retweeted == false ? "(推特用户id：" + useruid + ")的twitter\n转推了" : ""}`, rt_status);
            return payload.join("\n");
        }
        let pics = "";
        let src = "";
        if ("extended_entities" in tweet) {
            for (entity in tweet.extended_entities) {
                if (entity == "media") {
                    let media = tweet.extended_entities.media;
                    for (let i = 0; i < media.length; i++) {
                        text = text.replace(media[i].url, "");
                        if (media[i].type == "photo") {
                            //src = [media[i].media_url_https.substring(0, media[i].media_url_https.length - 4), '?format=jpg&name=4096x4096'].join("");
                            src = [media[i].media_url_https.substring(0, media[i].media_url_https.length - 4), (media[i].media_url_https.search("jpg") != -1 ? '?format=jpg&name=orig' : '?format=png&name=orig')].join(""); //?format=png&name=orig 可能出现这种情况
                            let temp = await sizeCheck(src);
                            pics += (temp == true ? `[CQ:image,cache=0,file=file:///${await downloadx(src, "photo", i)}]` : `[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, "photo", i)}] 注：这不是原图,原图大小为${temp}`);
                            logger2.info("src:" + src + " , media[i].media_url_https:" + media[i].media_url_https + `图片大小为${temp}MB`);
                        }
                        else if (media[i].type == "animated_gif") {
                            try {
                                logger2.info("media[i].video_info.variants[0].url:" + media[i].video_info.variants[0].url);
                                let gifpath0 = __dirname; //获取twitter.js文件的绝对路径
                                let gifpath = await downloadx(media[i].video_info.variants[0].url, "animated_gif", i); //下载gif视频并获得本地路径
                                let gifpath2 = await downloadx(media[i].media_url_https, "animated_gif", i); //gif第一帧封面
                                await exec(`ffmpeg -i ${gifpath} -loop 0 -y ${gifpath0}/temp.gif`)
                                    .then(async ({
                                        stdout,
                                        stderr
                                    }) => {
                                        if (stdout.length == 0) {
                                            //logger2.info("gifpath0：" + gifpath0);
                                            if (fs.statSync(`${gifpath0}/temp.gif`).size < PIC_MAX_SIZE) { //帧数过高可能发不出来gif,gif和插件模块放在一块，不在tmp文件夹里
                                                try {
                                                    await exec(`ffmpeg -i ${gifpath0}/temp.gif -f null -`) //判断gif的总帧数 https://www.npmjs.com/package/gif-meta https://github.com/indatawetrust/gif-meta
                                                        .then(async giftemp => {
                                                            let giftemp2 = /frame=(.+?)fps/.exec(JSON.stringify(giftemp.stderr))[1].replace("fps", "").trim();
                                                            logger2.info("gif的总帧数：" + giftemp2);
                                                            if (giftemp2 <= 300) {
                                                                //let gif = fs.readFileSync(`${__dirname}/temp.gif`);
                                                                //let base64gif = Buffer.from(gif, 'binary').toString('base64');
                                                                pics += `这是一张动图 [CQ:image,cache=0,file=file:///${gifpath2}]` + `\n原gif视频地址: ${media[i].video_info.variants[0].url}\n`
                                                                pics += `[CQ:image,cache=0,file=file:///${gifpath0}/temp.gif]`;
                                                                //pics += `[CQ:image,file=base64://${base64gif}]`;
                                                                //logger2.log(__dirname + "/temp.gif");
                                                                //pics += `[CQ:image,file=file:///${__dirname}/temp.gif]`;
                                                            } else {
                                                                if (video3[tweet.id_str.toString()] == undefined) {
                                                                    video3[tweet.id_str.toString()] = `[CQ:video,cache=0,file=file:///${gifpath},cover=file:///${gifpath2},c=3]`;
                                                                }
                                                                payload.push(`[CQ:image,cache=0,file=file:///${gifpath2}]`,
                                                                    `原gif视频地址: ${media[i].video_info.variants[0].url}`);
                                                            }
                                                        })
                                                } catch (err) {
                                                    logger2.error(new Date().toString() + ",判断gif的总帧数：" + err);
                                                }
                                            } else pics += `这是一张动图[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, "animated_gif", i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
                                        }
                                    })
                            } catch (err) {
                                logger2.error(new Date().toString() + ",推特动图：" + err);
                                pics += `这是一张动图 [CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, "animated_gif", i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
                            }
                            logger2.info("media[i].media_url_https:" + media[i].media_url_https);
                        }
                        else if (media[i].type == "video") {
                            let mp4obj = [];
                            for (let j = 0; j < media[i].video_info.variants.length; j++) {
                                if (media[i].video_info.variants[j].content_type == "video/mp4") mp4obj.push(media[i].video_info.variants[j]);
                            }
                            mp4obj.sort((a, b) => {
                                return b.bitrate - a.bitrate;
                            });
                            logger2.info("media[i].media_url_https:" + media[i].media_url_https);
                            let tmp = await sizeCheck(media[i].media_url_https, false);
                            if (tmp == true) {
                                let temp = await downloadx(media[i].media_url_https, "video", i);
                                if (video3[tweet.id_str.toString()] == undefined) {
                                    video3[tweet.id_str.toString()] = `[CQ:video,cache=0,file=file:///${await downloadx(mp4obj[0].url, "video2", i)},cover=file:///${temp},c=3]`;
                                    payload.push(`[CQ:image,cache=0,file=file:///${temp}]`,
                                        `视频地址: ${mp4obj[0].url}`);
                                }

                            } else {
                                payload.push(`该视频超过100MB，无法直接发送.该视频大小为${tmp}`,
                                    `视频地址: ${mp4obj[0].url}`);
                            }
                        }
                    }
                }
            }
            if (pics != "") payload.push(pics);
        }
        logger2.info("2");

        if (!end_point && "is_quote_status" in tweet && tweet.is_quote_status == true) {
            let quote_tweet = await getSingleTweet(tweet.quoted_status_id_str);
            headpicshu2++;
            payload.push("提到了", await format(quote_tweet, -1, false, true, headpicshu2));
            text = text.replace(tweet.quoted_status_permalink.url, "");
        }
        logger2.info("3");

        if ("in_reply_to_status_id" in tweet && tweet.in_reply_to_status_id != null && !end_point) {
            let reply_tweet = await getSingleTweet(tweet.in_reply_to_status_id_str);
            headpicshu2++;
            payload.push("回复了", await format(reply_tweet, -1, false, true, headpicshu2));
        }
        let ii = 0;
        if ("card" in tweet) {
            // payload.push(tweet.binding_values.title.string_value, urlExpand(card.url));
            if (/poll\dchoice/.test(tweet.card.name)) {
                let i = 0;
                if ("image_large" in tweet.card.binding_values) {
                    logger2.info("tweet.card.binding_values.image_large.url:" + tweet.card.binding_values.image_large.url);
                    payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.image_large.url, "image_large", i)}]`);
                    i++;
                }
                /*let end_time = new Intl.DateTimeFormat('zh-Hans-CN', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Shanghai'
                    })
                    .format(new Date(tweet.card.binding_values.end_datetime_utc.string_value))*/
                let end_time = dayjs(new Date(tweet.card.binding_values.end_datetime_utc.string_value).toString()).format('YYYY-MM-DD HH:mm:ss 星期d').replace("星期0", "星期天");
                //logger2.log(end_time);
                //logger2.log(new Date(tweet.card.binding_values.end_datetime_utc.string_value).toString());
                //logger2.log(tweet.card.binding_values.end_datetime_utc.string_value);

                payload.push("", tweet.card.binding_values.counts_are_final.boolean_value === true ? "投票已结束" :
                    `正在投票,结束时间：${end_time}`);
                let nchoice = parseInt(/\d/.exec(tweet.card.name)[0]);
                let count = "";
                let lable = "";
                for (i = 1; i < nchoice + 1; i++) {
                    lable = tweet.card.binding_values[`choice${i}_label`].string_value;
                    count = tweet.card.binding_values[`choice${i}_count`].string_value;
                    payload.push(`${lable}:  ${count}`);
                }
            }
            else if (/summary/.test(tweet.card.name)) {
                if ("photo_image_full_size_original" in tweet.card.binding_values) {
                    let temp = await sizeCheck(tweet.card.binding_values.photo_image_full_size_original.image_value.url);
                    if (temp == true) {
                        logger2.info("tweet.card.binding_values.photo_image_full_size_original.image_value.url:" + tweet.card.binding_values.photo_image_full_size_original.image_value.url);
                        payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_original.image_value.url, "photo_image_full", ii)}]`);
                    } else {
                        logger2.info("tweet.card.binding_values.photo_image_full_size_large.image_value.url:" + tweet.card.binding_values.photo_image_full_size_large.image_value.url + ` , 原图片大小为${temp}`);
                        payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_large.image_value.url, "photo_image_full", ii)}]\n原图片大小为${temp}`);
                    }
                    ii++;
                }
                //logger2.info(JSON.stringify(tweet));
                //logger2.info(tweet.card.binding_values.title.string_value);
                if (tweet.card.binding_values.description != null) {
                    //logger2.info(tweet.card.binding_values.description.string_value);
                    payload.push(tweet.card.binding_values.title.string_value, tweet.card.binding_values.description.string_value); //推特卡片标题+简介
                } else {
                    //logger2.info(tweet.card.binding_values.description.string_value);
                    payload.push(tweet.card.binding_values.title.string_value); //推特卡片标题
                }
            }
        }
        logger2.info("原文：" + text);
        if (temp2[tweet.id_str.toString()] == undefined) {
            temp2[tweet.id_str.toString()] = await translate.translate2(text, tweet.id_str, config.default.translate.youdao.trans1, config.default.translate.baidu.trans2, config.default.translate.tx.trans3);//文本，每个推特的id，有道开关，百度开关,腾讯开关
            //temp2[tweet.id_str.toString()] = await translate.translate("auto", "zh", text /*.replace(/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]/g, "")*/);
            //https://blog.csdn.net/libin_1/article/details/51483815 JavaScript正则表达式大全（过滤Emoji的最佳实践）
            //https://blog.csdn.net/TKG09/article/details/53309455 js判断与过滤emoji表情的方法
        }
        //logger2.info(temp2[tweet.id_str.toString()]);
        //logger2.info(tweet.id_str.toString());
        text = text + "\n" + (temp2[tweet.id_str.toString()] != undefined ? temp2[tweet.id_str.toString()] : "");
        if ("urls" in tweet.entities && tweet.entities.urls.length > 0) {
            for (let i = 0; i < tweet.entities.urls.length; i++) {
                text = text.replace(tweet.entities.urls[i].url, tweet.entities.urls[i].expanded_url);
            }
        }
        logger2.info("5");
        //logger2.info(JSON.stringify(tweet.user));
        let headpic2 = tweet.user.headpic || tweet.user.profile_image_url_https;
        payload.unshift(`[CQ:image,cache=0,file=file:///${await downloadx(headpic2.replace("_normal", "_bigger"), "headpic", headpicshu1)}]\n${tweet.user.name}${useruid != -1 & retweeted == false ? "(推特用户id：" + useruid + ")的twitter\n更新了" : ""}`, text);
        //是反着发的
        logger2.info("6");

        return payload.join("\n");
    }
    catch (err) {
        logger2.error(new Date().toString() + ",推特format:" + err);
        payload.push(`${tweet.user.name}的Twitter`, text);
        return payload.join("\n");
    }
}

/**
 * 将Twitter的t.co短网址扩展为原网址
 * @param {string} twitter_short_url Twitter短网址
 * @returns Promise  原网址
 */
function urlExpand(twitter_short_url) {
    return axios({
        method: "GET",
        url: twitter_short_url,
        headers: httpHeader(),
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        return /URL=(http.+?)">/.exec(res.data)[1];
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特:" + err.response.data);
        return false;
    });
}

function rtTimeline(context, name, num) {
    searchUser(name).then(user => {
        if (!user) {
            replyFunc(context, "未找到该推特");
            suo = false;
        } else if (user.protected == true) {
            replyFunc(context, "该twitter受到保护，无法浏览");
            suo = false;
        } else {
            let tweets;
            getUserTimeline(user.id_str, 10).then(async timeline => {
                tweets = [];
                logger2.info(JSON.stringify(timeline[0].user));
                if (num == -1) { //获取置顶推
                    logger2.info(JSON.stringify("置顶贴:" + timeline[0].user.pinned[0]));
                    if (timeline[0].user.pinned[0] == undefined) {
                        replyFunc(context, "该用户没有置顶的推特");
                    }
                    getSingleTweet(timeline[0].user.pinned[0]).then(tweet => {
                        format(tweet).then(tweet_string => {
                            logger2.info(tweet_string);
                            replyFunc(context, tweet_string);
                            if (video3[timeline[0].user.pinned[0].toString()] != undefined) {
                                replyFunc(context, video3[timeline[0].user.pinned[0].toString()]);
                            }
                            temp2 = null;
                            temp2 = new Array();
                            video3 = null;
                            video3 = new Array();
                            suo = false;
                            //logger2.info("video3: " + video3);
                            //logger2.info("temp2: " + temp2);
                        }).catch(err => {
                            logger2.error(new Date().toString() + ",推特choose_one+format:" + err);
                            temp2 = null;
                            temp2 = new Array();
                            video3 = null;
                            video3 = new Array();
                            suo = false;
                        });
                    }).catch(err => {
                        logger2.error(new Date().toString() + ",推特置顶推format:" + err);
                        temp2 = null;
                        temp2 = new Array();
                        video3 = null;
                        video3 = new Array();
                        suo = false;
                    });
                    return true;
                }
                for (let tweet of timeline) {
                    if (!"retweeted_status_id_str" in tweet || !/^RT @/.test(tweet.full_text)) {
                        tweets.push(tweet);
                    }
                }
                if (tweets.length < num) tweets = timeline;
                let choose_one = tweets[num];
                //choose_one.user = { name: user.name };
                format(choose_one).then(tweet_string => {
                    let payload = [tweet_string, `https://twitter.com/${user.screen_name}/status/${choose_one.id_str}`].join('\n\n');
                    logger2.info(payload);
                    replyFunc(context, payload);
                    if (video3[choose_one.id_str.toString()] != undefined) {
                        replyFunc(context, video3[choose_one.id_str.toString()]);
                    }
                    //logger2.info("2: " + temp2);
                    temp2 = null;
                    temp2 = new Array();
                    video3 = null;
                    video3 = new Array();
                    suo = false;
                    //logger2.info("3: " + temp2);
                }).catch(err => {
                    logger2.error(new Date().toString() + ",推特getUserTimeline2:" + err);
                    suo = false;
                    temp2 = null;
                    temp2 = new Array();
                    video3 = null;
                    video3 = new Array();
                    //error: Fri Oct 16 2020 07:02:20 GMT+0800 (GMT+08:00),推特rtTimeline：TypeError: Cannot use 'in' operator to search for 'full_text' in undefined
                });
            }).catch(err => {
                logger2.error(new Date().toString() + ",推特getUserTimeline1:" + err);
                suo = false;
                temp2 = null;
                temp2 = new Array();
                video3 = null;
                video3 = new Array();
            });
        }
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特searchUser:" + err);
        suo = false;
        temp2 = null;
        temp2 = new Array();
        video3 = null;
        video3 = new Array();
    });
}

function rtSingleTweet(tweet_id_str, context) {
    getSingleTweet(tweet_id_str).then(tweet => {
        format(tweet, -1, false, true, 0, context).then(tweet_string => {
            logger2.info(tweet_string);
            replyFunc(context, tweet_string);
            if (video3[tweet_id_str.toString()] != undefined) {
                replyFunc(context, video3[tweet_id_str.toString()]);
            }
            temp2 = null;
            temp2 = new Array();
            suo = false;
            video3 = null;
            video3 = new Array();
            //logger2.info("video3: " + video3);
            //logger2.info("temp2: " + temp2);
        }).catch(err => {
            temp2 = null;
            temp2 = new Array();
            suo = false;
            video3 = null;
            video3 = new Array();
        });
    }).catch(err => {
        temp2 = null;
        temp2 = new Array();
        suo = false;
        video3 = null;
        video3 = new Array();
    });
}

/**
 * 通过用户名添加订阅
 * @param {string} name Twitter用户名
 * @param {string} option_nl 偏好设置，可以是"仅原创"，"包含转发"，"仅带图"
 * @param {object} context
 * @returns {boolean} 成功返回true
 */
async function addSub(name, option_nl, context) {
    let user = await searchUser(name);
    if (!user) {
        replyFunc(context, "未发现该用户或者输入0-9之外的数字", true);
        return true;
    }
    if (option_nl == undefined) option_nl = "仅原创";
    let option_list = option_nl.split(/[;；]/).filter((noEmpty) => { return noEmpty != undefined });
    let option = {
        username: user.screen_name,
        name: user.name,
        //headpic:user.profile_image_url_https,
    };
    for (let opt of option_list) {
        let opt_ = opt.split(/(?<!\[CQ:.+)[=＝]/);
        let opt_inter = OPTION_MAP[opt_[0].trim()] || false;
        if (!opt_inter) {
            replyFunc(context, `没有${opt}这个选项`, true);
            return true;
        }
        /*else {//大概是at机器人才反应
            if (opt_inter == "notice") {
                let people = opt_[1].trim();
                if (!/\[CQ:at/.test(people)) {
                    replyFunc(context, "你这提醒区怎么一个at都么有搞mea?", true);
                    return true;
                }
                option.notice = people;
            }
            else option.post = opt_inter;
        }*/
    }
    if (option.post == undefined) option.post = "origin_only";
    subscribe(user, option, context);
    return true;
}

function twitterAggr(context) {
    let gid = context.group_id;
    let uid = context.user_id;
    if (context.user_id != null) {
        const cacheKeys = [`${uid}`]; //防止单个QQ快速刷回复
        if (cacheKeys.some(key => cache.has(key))) {
            return;
        }
        [uid].forEach((id, i) => id && cache.set(cacheKeys[i], true));
    }
    if (context.group_id != null) {
        let cacheKeys = [`${gid}`]; //防止这个群快速刷回复 
        if (cacheKeys.some(key => cache2.has(key))) {
            return;
        }
        [gid].forEach((id, i) => id && cache2.set(cacheKeys[i], true));
    }
    if (connection && /^看看(.+?)的?((第[0-9]?[一二三四五六七八九]?条)|(上*条)|(最新)|(置顶))?\s?(推特|twitter)$/i.test(context.message)) {
        if (suo == true) {
            return;
        } else {
            suo = true;
        }
        let num = 0;
        let name = "";
        if (/置顶/.test(context.message)) (num = -1);
        else if (/最新/.test(context.message)) (num = 0);
        else if (/上上上条/.test(context.message)) (num = 3);
        else if (/上上条/.test(context.message)) (num = 2);
        else if (/上一?条/.test(context.message)) (num = 1);
        else if (/第.+?条/.test(context.message)) {
            let temp = /第([0-9]|[一二三四五六七八九])条/.exec(context.message)[1];
            if (temp != null) {
                temp = temp[1];
            } else {
                temp = 0;
            }
            if (temp == 0 || temp == "零") (num = -1);
            else if (temp == 1 || temp == "一") (num = 0);
            else if (temp == 2 || temp == "二") (num = 1);
            else if (temp == 3 || temp == "三") (num = 2);
            else if (temp == 4 || temp == "四") (num = 3);
            else if (temp == 5 || temp == "五") (num = 4);
            else if (temp == 6 || temp == "六") (num = 5);
            else if (temp == 7 || temp == "七") (num = 6);
            else if (temp == 8 || temp == "八") (num = 7);
            else if (temp == 9 || temp == "九") (num = 8);
        }
        else num = 0;
        name = /看看(.+?)的?((第[0-9]?[一二三四五六七八九]?条)|(上{1,3}一?条)|(置顶)|(最新))?\s?(推特|twitter)/i.exec(context.message)[1];
        rtTimeline(context, name, num);
        return true;
    }
    else if (connection && /^看看https:\/\/(mobile\.)?twitter.com\/.+?\/status\/(\d+)/i.test(context.message)) {
        if (suo == true) {
            return;
        } else {
            suo = true;
        }
        let tweet_id = /status\/(\d+)/i.exec(context.message)[1];
        rtSingleTweet(tweet_id, context);
        return true;
    }
    else if (connection && /^订阅(推特|twitter)https:\/\/twitter.com\/.+(\/status\/\d+)?([>＞](.{2,}))?/i.test(context.message)) {
        let name = (/status\/\d+/.test(context.message) && /\.com\/(.+)\/status/.exec(context.message)[1] ||
            /\.com\/(.+)[>＞]/.exec(context.message)[1]);
        let option_nl = /[>＞](?<option_nl>.{2,})/.exec(context.message)[1];
        if (option_nl == undefined) option_nl = "仅原创"
        addSub(name, option_nl, context);
        return true;
    }
    else if (connection && /^订阅.+的?(推特|twitter)([>＞](?<option_nl>.{2,}))?/i.test(context.message)) {
        let {
            groups: {
                name, option_nl
            } } = /订阅(?<name>.+)的?(推特|twitter)([>＞](?<option_nl>.{2,}))?/i.exec(context.message);
        addSub(name, option_nl, context);
        return true;
    }
    else if (/^取消订阅.+的?(推特|twitter)$/i.test(context.message)) {
        let name = /取消订阅(.+)的?(推特|twitter)/i.exec(context.message)[1];
        unSubscribe(name, context);
        return true;
    }
    else if (/^查看(推特|twitter)订阅$/i.test(context.message)) {
        checkSubs(context);
        return true;
    }
    else if (/^清空(推特|twitter)订阅$/i.test(context.message)) {
        if (/owner|admin/.test(context.sender.role)) clearSubs(context, context.group_id);
        else replyFunc(context, '无权限');
        return true;
    } else if (connection && (/^看看https:\/\/(video\.)?twimg\.com\/tweet_video\/.*\.mp4/i.test(context.message) || /^看看https:\/\/(video\.)?twimg\.com\/amplify_video\/\d+\/vid\/1280x720\/.*\.mp4/i.test(context.message) || /^看看https:\/\/(video\.)?twimg\.com\/ext_tw_video\/\d+\/pu\/vid\/1280x720\/.*\.mp4/i.test(context.message))) {
        //logger2.info("video");
        if (suo == true) {
            return;
        } else {
            suo = true;
        }
        let url = /https:\/\/video\.twimg\.com\/tweet_video\/.*\.mp4/.exec(context.message) || /https:\/\/video\.twimg\.com\/amplify_video\/\d+\/vid\/1280x720\/.*\.mp4/.exec(context.message) || /https:\/\/video\.twimg\.com\/ext_tw_video\/\d+\/pu\/vid\/1280x720\/.*\.mp4/.exec(context.message);
        if (url != null) {
            downloadvideo(url[0], context);
        }
        return true;
    }
    else {
        return false;
    }
}

//setAgent();
firstConnect();
checkTwiTimeline();

module.exports = {
    twitterAggr,
    twitterReply,
    checkTwiTimeline,
    clearSubs
};