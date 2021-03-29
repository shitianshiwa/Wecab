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
    "仅原创": [1, 0, 0, 1],
    "仅转发": [0, 1, 0, 0],
    "包含转发": [1, 1, 0, 1],
    "不要转发": [1, 0, 1, 1],
    "仅回复": [0, 0, 1, 0],
    "包含回复": [1, 0, 1, 1],
    "不要回复": [1, 1, 0, 1],
    "只看图": [0, 0, 0, 1],
    "全部": [1, 1, 1, 1]
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
    //logger2.info("推特:" + msg)
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

/** 用value找key*/
function toOptNl(option) {
    let {
        origin,
        retweet,
        reply,
        pic
    } = option;
    option = [origin, retweet, reply, pic];
    for (let key in OPTION_MAP) {
        if (OPTION_MAP[key].join("") == option.join("")) return key;
    }
}

function opt_dict(option_list) {
    let [origin, retweet, reply, pic] = option_list;
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
        //logger2.info(JSON.stringify(res.data));
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
            "userId": user_id,    //https://twitter.com/intent/user?user_id=
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
    }).then(async res => {
        //logger2.info("twitter_userid  :" + user_id);
        logger2.info("getUserTimeline/x-rate-limit-limit: " + res.headers["x-rate-limit-limit"]);
        logger2.info("getUserTimeline/x-rate-limit-remaining: " + res.headers["x-rate-limit-remaining"]);
        logger2.info("getUserTimeline/x-rate-limit-reset: " + res.headers["x-rate-limit-reset"]);
        //logger2.info("timeline:" + JSON.stringify(res.data));
        let tweets = [];
        let owner = res.data.globalObjects.users[user_id];
        let username = "";
        let userscreen_name = "";
        let userprofile_image_url_https = "";
        let userpinned_tweet_ids_str = "";
        let tweet = "";
        let twitterid = "";
        for (let tweetid of Object.keys(res.data.globalObjects.tweets)) {
            //获取推特
            tweet = res.data.globalObjects.tweets[tweetid];//获取单条推特
            twitterid = "";
            let user_mentions = tweet.entities.user_mentions;
            if (user_mentions != undefined) {
                twitterid = user_mentions[0].id_str;//RT @ entities.user_mentions[0].id_str 转发的原用户id位置
                /*if (tweet.in_reply_to_user_id_str != null) {
                
                   //user_id_str 回复
                }*/
            }
            else {
                twitterid = tweet.user_id_str;//user_id_str 自己发的推特
            }
            let user = res.data.globalObjects.users[twitterid];
            if (user == undefined) {
                let user2 = await searchUser(user_mentions[0].screen_name);
                //logger2.info(JSON.stringify(user2));
                username = user2.name;
                userscreen_name = user2.screen_name;
                userprofile_image_url_https = user2.profile_image_url_https;
                userpinned_tweet_ids_str = user2.pinned_tweet_ids_str;
            }
            else {
                username = user.name;
                userscreen_name = user.screen_name;
                userprofile_image_url_https = user.profile_image_url_https;
                userpinned_tweet_ids_str = user.pinned_tweet_ids_str;
            }
            //logger2.info("0," + tweet.entities.user_mentions);
            //logger2.info("1," + user_mentions[0].id_str);
            /*        logger2.info("2," + tweet.user_id_str)
                      logger2.info("3," + twitterid)
                      //logger2.info("4," + JSON.stringify(res.data.globalObjects.users))
                      //logger2.info("owner:" + JSON.stringify(owner));
                      logger2.info("user:" + JSON.stringify(user));
                      logger2.info(owner.name);
                      logger2.info(owner.screen_name);
                      logger2.info(owner.profile_image_url_https);
                      logger2.info(owner.pinned_tweet_ids_str);
                      logger2.info(username);
                      logger2.info(userscreen_name);
                      logger2.info(userprofile_image_url_https);
                      logger2.info(userpinned_tweet_ids_str);
          */
            tweet.user = {
                id_str: twitterid,
                name1: owner.name,
                screen_name1: owner.screen_name,
                headpic1: owner.profile_image_url_https,
                pinned1: owner.pinned_tweet_ids_str,
                name2: username,
                screen_name2: userscreen_name,
                headpic2: userprofile_image_url_https,
                pinned2: userpinned_tweet_ids_str,
            };
            //昵称 订阅推特           
            //名字
            //推特用户id
            //用户头像
            //该用户置顶推特id
            //昵称 转推
            //名字
            //推特用户id
            //用户头像
            //该用户置顶推特id
            tweets.push(tweet);
        }
        //logger2.info("tweets:" + JSON.stringify(tweets))
        tweets = tweets.sort((a, b) => { return (parseFloat(a.id_str) > parseFloat(b.id_str)) ? -1 : 1; });
        /*for (let i = 0; i < tweets.length; i++) {
            logger2.info(tweets[i].id_str)
        }*/
        return tweets;
    }).catch(err => {
        //logger2.error(new Date().toString() + ",twitter getUserTimeline error2:" + err);
        try {
            logger2.error(new Date().toString() + ",twitter getUserTimeline error1:" + JSON.stringify(err));
        }
        catch (e) {
            logger2.error(new Date().toString() + ",twitter getUserTimeline error2:" + err);
        }
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
async function subscribe(user, option, context) {
    //logger2.info(JSON.stringify(user));

    let uid = user.uid;
    let group_id = context.group_id;
    let name = user.name;
    let username = user.screen_name;
    let option_nl = toOptNl(option);
    //logger2.info("name:" + name)
    await mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let coll = mongo.db('bot').collection('twitter');
        let res = await coll.find({
            uid: uid,
        }).toArray();
        if (res.length == 0) {
            let tweet = (await getUserTimeline(uid, 15, 1))[0];
            //logger2.info("tweet:" + JSON.stringify(tweet))
            if (tweet == undefined) {
                replyFunc(context, `无法订阅该twitter`, true);
                return false;
            }
            let tweet_id = tweet.id_str;
            coll.insertOne({
                uid: uid,
                name: name,
                username: username,
                tweet_id: tweet_id,
                groups: [group_id],
                [group_id]: option
            },
                (err) => {
                    if (err) logger2.error(new Date().toString() + ",twitter subscribes insert error:" + err);
                    else replyFunc(context, `已订阅${name}(推特用户id：${uid})的twitter，模式为${option_nl}`, true);
                    mongo.close();
                });
        } else {
            coll.findOneAndUpdate({
                uid: uid
            }, {
                $addToSet: {
                    groups: group_id
                },
                $set: {
                    [group_id]: option
                }
            },
                (err, result) => {
                    if (err) logger2.error(new Date().toString() + ",twitter subscribes update error:" + err);
                    else {
                        let text = "";
                        if (result.value.groups.includes(group_id)) text = "重复订阅！";
                        else text = `已订阅${result.value.name}(推特用户id：${uid})的twitter，模式为${option_nl}`;
                        replyFunc(context, text, true);
                        mongo.close();
                    }
                });
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
    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let coll = mongo.db('bot').collection('twitter');
        await coll.findOneAndUpdate({
            uid: uid,
            //name: name_reg
        }, {
            $pull: {
                groups: {
                    $in: [group_id]
                }
            },
            $unset: {
                [group_id]: []
            }
        },
            async (err, result) => {
                if (err) logger2.error(new Date().toString() + ",推特:" + err + ",database subscribes delete error");
                else {
                    let text = "";
                    if (result.value == null || !result.value.groups.includes(group_id)) text = "未发现任何推特订阅";
                    else {
                        text = "已取消订阅" + result.value.name + "(推特用户id：" + uid + ")" + "的twitter";
                        if (result.value.groups.length <= 1) await coll.deleteOne({
                            _id: result.value._id
                        });
                    }
                    replyFunc(context, text, true);
                }
                mongo.close();
            });
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter unsubscribe error, uid= " + uid));
}

/**
 * 每过x分钟检查一次订阅列表，如果订阅一个Twitter账号的群的数量是0就删除
 */
let temptemp = new Array();
async function checkTwiTimeline() {
    if (!connection) return;
    //return; //未做测试警告
    let firish = false;
    let check_interval = 3 * 60 * 1000; //3分钟一次
    let check_interval2 = 20000; //api调用延时 20秒
    let i = 0;
    setInterval(async () => {
        if (wecab.getItem("huozhe") == "false") {
            logger2.info(new Date().toString() + ",连不上机器人，跳过订阅twitter"); //长时间连不上还是可能丢失信息的，因为消息源会更新覆盖旧的
            return;
        }
        if (firish == true) {
            return;
        }
        ClearDownloadx();
        await mongodb(DB_PATH, {
            useUnifiedTopology: true
        }).connect().then(async mongo => {
            let coll = mongo.db('bot').collection('twitter');
            let subscribes = await coll.find({}).toArray();
            //logger2.info("twittersubscribes:" + JSON.stringify(subscribes));
            //console.log(subscribes.length);
            if (subscribes != undefined && subscribes.length > 0) {
                i = 0;
                checkEach();
            } else {
                subscribes = await coll.find({}).toArray();
                if (subscribes != undefined) {
                    /*logger2.info("推特订阅数：" + subscribes.length);*/
                }
                else {
                    logger2.error(new Date().toString() + ",twitter database error");
                }
            }
            mongo.close();

            function checkEach() {
                if (subscribes[i] == undefined) {
                    return;
                }
                //logger2.info("subscribes0:" + JSON.stringify(subscribes));
                setTimeout(async () => {
                    try {
                        let ii = new Array();
                        //logger2.info("subscribes:" + subscribes[i].uid);
                        let tweet_list = await getUserTimeline(subscribes[i].uid, 10, 1, 1);
                        if (tweet_list != undefined) {
                            let last_tweet_id = subscribes[i].tweet_id; //最新一条推特id
                            let current_id = tweet_list[0].id_str;
                            //logger2.info("tweet_list:"+JSON.stringify(tweet_list));
                            //logger2.info("last_tweet_id:" + last_tweet_id);
                            //logger2.info("current_id:" + current_id);
                            if (parseFloat(current_id) > parseFloat(last_tweet_id)) {
                                suo = true;
                                let groups = subscribes[i].groups;
                                for (let tweet of tweet_list) {//要转发的推特数
                                    if (parseFloat(tweet.id_str) > parseFloat(last_tweet_id)) { //每一个推，一次发完所有订阅的群，直到所有推特发完
                                        let suo2 = true;
                                        groups.forEach(async group_id => {//要发送的群
                                            if (ii[group_id] == undefined) {
                                                ii[group_id] = 1;
                                            }
                                            if (checkOption(tweet, subscribes[i][group_id])) {//判断是否符合转发条件
                                                await format(tweet, subscribes[i].uid, false, false, 0, ii[group_id]).then(payload => {
                                                    let temp = tweet.user.screen_name1 == tweet.user.screen_name2 ? tweet.user.screen_name1 : tweet.user.screen_name2;
                                                    //payload = ii[group_id] + "\n" + payload;
                                                    payload += `\nhttps://twitter.com/${temp}/status/${tweet.id_str}\n`
                                                    for (let x = 0; x < temptemp.length; x++) {
                                                        if (temptemp[x] == tweet.id_str) {
                                                            suo2 = false;
                                                        }
                                                    }
                                                    temptemp.push(tweet.id_str);
                                                    logger2.info("temptemp:" + temptemp);
                                                    logger2.info("tweet.id_str:" + tweet.id_str);
                                                    if (suo2 == true) {
                                                        replyFunc({
                                                            group_id: group_id,
                                                            message_type: "group"
                                                        }, payload);
                                                        /*replyFunc({
                                                            group_id: group_id,
                                                            message_type: "group"
                                                        }, ii[group_id] + `https://twitter.com/${temp}/status/${tweet.id_str}`);*/
                                                        ii[group_id] = ii[group_id] + 1;
                                                        if (video3[tweet.id_str.toString()] != undefined) {
                                                            replyFunc({
                                                                group_id: group_id,
                                                                message_type: "group"
                                                            }, video3[tweet.id_str.toString()]);
                                                        }
                                                    }
                                                }).catch(err => logger2.error(new Date().toString() + ",推特6：" + err));
                                            }
                                        });
                                    }
                                    temp2 = null;
                                    temp2 = new Array();
                                    video3 = null;
                                    video3 = new Array();
                                    temptemp = null;
                                    temptemp = new Array();
                                }
                                await mongodb(DB_PATH, {
                                    useUnifiedTopology: true
                                }).connect().then(async mongo => {
                                    let coll = mongo.db('bot').collection('twitter');
                                    await coll.updateOne({
                                        uid: subscribes[i].uid
                                    }, {
                                        $set: {
                                            tweet_id: current_id,
                                            name: tweet_list[0].user.name
                                        }
                                    },
                                        (err, result) => {
                                            if (err) logger2.error(new Date().toString() + ",推特:" + err + ",database update error during checktwitter");
                                            mongo.close();
                                        });
                                });
                            }
                        }
                    } catch (err) {
                        logger2.error(new Date().toString() + ",推特:" + err + ',' + JSON.stringify(subscribes[i]));
                    } finally {
                        i++;
                        if (i < subscribes.length) {
                            checkEach();
                        } else {
                            temp2 = null;
                            temp2 = new Array();
                            video3 = null;
                            video3 = new Array();
                            temptemp = null;
                            temptemp = new Array();
                            //logger2.info("video3: " + video3);
                            //处理最后一个推特会残留的机翻文本
                            //logger2.info("temp2: " + temp2);
                            suo = false;
                            firish = false;
                        }

                    }
                }, check_interval2);
            }
        });
    }, check_interval)

    function checkOption(tweet, option) {
        let status = "";
        if ("retweeted_status" in tweet || "retweeted_status_id_str" in tweet || /^RT @/.test(tweet.full_text)) status = "retweet";
        else if ("in_reply_to_status_id" in tweet && tweet.in_reply_to_status_id != null) status = "reply";
        else if ("media" in tweet.entities && tweet.entities.media[0].type == "photo") status = "pic";
        else status = "origin"

        switch (status) {
            case "origin":
                if (option.origin == 1) return true;
                break;
            case "reply":
                if (option.reply == 1) return true;
                break;
            case "retweet":
                if (option.retweet == 1) return true;
                break;
            case "pic":
                if (option.pic == 1) return true;
                break;
            default:
                return false;
        }
    }
}

/**
 * 查看推特订阅列表
 * @param {object} context
 * @returns {} no return
 */
function checkSubs(context) {
    let group_id = context.group_id;
    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let coll = mongo.db('bot').collection('twitter');
        await coll.find({
            groups: {
                $elemMatch: {
                    $eq: group_id
                }
            }
        }, {
            projection: {
                _id: 0
            }
        })
            .toArray().then(result => {
                if (result.length > 0) {
                    let name_list = [];
                    result.forEach(twitter_obj => {
                        let option_nl = "仅原创";
                        option_nl = toOptNl(twitter_obj[group_id]);
                        name_list.push(`${twitter_obj.name}，推特用户id：${twitter_obj.uid}，${option_nl}`);
                    });
                    let subs = "本群已订阅:\n" + name_list.join("\n");
                    replyFunc(context, subs, true);
                } else replyFunc(context, "未发现任何推特订阅", true);
                mongo.close();
            })
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
        replyFunc(context, `[CQ:video,cache=0,file=file:///${await downloadx(url, "video2", -1, false)},cover=file:///${__dirname}/black.jpg,c=3]`)
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
async function format(tweet, useruid = -1, end_point = false, retweeted = false, headpicshu1 = 0, index = 0, nocheck = false) {
    if (!tweet) return "Twitter转发时错误";
    let payload = [];
    let text = "";
    let headpicshu2 = headpicshu1;
    let name = (tweet.user.name1 == tweet.user.name2 ? tweet.user.name1 : tweet.user.name2) || tweet.user.name;
    let headpic2 = (tweet.user.headpic1 == tweet.user.headpic2 ? tweet.user.headpic1 : tweet.user.headpic2) || tweet.user.profile_image_url_https;
    //logger2.info("tweet.user:" + JSON.stringify(tweet));
    if ("full_text" in tweet) text = tweet.full_text;
    else text = tweet.text;
    text = text.replace(/&amp;/g, "&").replace(/&#91;/g, "[").replace(/&#93;/g, "]").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    try {
        if ("retweeted_status" in tweet) {
            //logger2.info("转发:" + await getSingleTweet(tweet.retweeted_status_id_str));
            //let rt_status = await format(await getSingleTweet(tweet.retweeted_status_id_str), -1, false, true, 0, "retweeted");
            headpicshu2++;
            let rt_status = await format(tweet.retweeted_status, -1, false, true, headpicshu2, index, nocheck);
            payload.push(/*`[CQ:image,cache=0,file=file:///${await downloadx(headpic2.replace("_normal", "_bigger"), ("headpic" + index), headpicshu1)}]\n来自${name}的twitter\n转推了`,*/ rt_status);//${useruid != -1 & retweeted == false ? "的twitter\n转推了" : ""}
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
                            pics += (temp == true ? `[CQ:image,cache=0,file=file:///${await downloadx(src, ("photo" + index + headpicshu1), i)}]` : `[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, ("photo" + index + headpicshu1), i)}] 注：这不是原图,原图大小为${temp}`);
                            logger2.info("src:" + src + " , media[i].media_url_https:" + media[i].media_url_https + `图片大小为${temp}MB`);
                        }
                        else if (media[i].type == "animated_gif") {
                            try {
                                logger2.info("media[i].video_info.variants[0].url:" + media[i].video_info.variants[0].url);
                                let gifpath0 = __dirname; //获取twitter.js文件的绝对路径
                                let gifpath = await downloadx(media[i].video_info.variants[0].url, ("animated_gif" + index + headpicshu1), i, false); //下载gif视频并获得本地路径
                                let gifpath2 = await downloadx(media[i].media_url_https, ("animated_gif" + index + headpicshu1), i); //gif第一帧封面
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
                                            } else pics += `这是一张动图[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, ("animated_gif" + index + headpicshu1), i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
                                        }
                                    })
                            } catch (err) {
                                logger2.error(new Date().toString() + ",推特动图：" + err);
                                pics += `这是一张动图 [CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https, ("animated_gif" + index + headpicshu1), i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
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
                                let temp = await downloadx(media[i].media_url_https, ("video" + index + headpicshu1), i);
                                if (video3[tweet.id_str.toString()] == undefined) {
                                    video3[tweet.id_str.toString()] = `[CQ:video,cache=0,file=file:///${await downloadx(mp4obj[0].url, ("video2" + index + headpicshu1), i, false)},cover=file:///${temp},c=3]`;
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
        if (!end_point && "is_quote_status" in tweet && tweet.is_quote_status == true) {
            let quote_tweet = await getSingleTweet(tweet.quoted_status_id_str);
            headpicshu2++;
            logger2.info("headpicshu2:" + headpicshu2);
            payload.push("提到了", await format(quote_tweet, -1, false, true, headpicshu2, index, nocheck));
            text = text.replace(tweet.quoted_status_permalink.url, "");
        }
        if ("in_reply_to_status_id" in tweet && tweet.in_reply_to_status_id != null && !end_point) {
            let reply_tweet = await getSingleTweet(tweet.in_reply_to_status_id_str);
            headpicshu2++;
            logger2.info("headpicshu2:" + headpicshu2);
            payload.push("回复了", await format(reply_tweet, -1, false, true, headpicshu2, index, nocheck));
        }
        let ii = 0;
        if ("card" in tweet) {
            // payload.push(tweet.binding_values.title.string_value, urlExpand(card.url));
            if (/poll\dchoice/.test(tweet.card.name)) {
                let i = 0;
                if ("image_large" in tweet.card.binding_values) {
                    logger2.info("tweet.card.binding_values.image_large.url:" + tweet.card.binding_values.image_large.url);
                    payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.image_large.url, ("image_large" + index + headpicshu1), i)}]`);
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
                        payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_original.image_value.url, ("photo_image_full" + index + headpicshu1), ii)}]`);
                    } else {
                        logger2.info("tweet.card.binding_values.photo_image_full_size_large.image_value.url:" + tweet.card.binding_values.photo_image_full_size_large.image_value.url + ` , 原图片大小为${temp}`);
                        payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_large.image_value.url, ("photo_image_full" + index + headpicshu1), ii)}]\n原图片大小为${temp}`);
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
        //logger2.info("原文：" + text);
        if (temp2[tweet.id_str.toString()] == undefined) {
            temp2[tweet.id_str.toString()] = await translate.translate2(text, tweet.id_str, config.default.translate.youdao.trans1, config.default.translate.baidu.trans2, config.default.translate.tx.trans3);//文本，每个推特的id，有道开关，百度开关,腾讯开关
            //temp2[tweet.id_str.toString()] = await translate.translate("auto", "zh", text /*.replace(/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]/g, "")*/);
            //https://blog.csdn.net/libin_1/article/details/51483815 JavaScript正则表达式大全（过滤Emoji的最佳实践）
            //https://blog.csdn.net/TKG09/article/details/53309455 js判断与过滤emoji表情的方法
        }
        //logger2.info(temp2[tweet.id_str.toString()]);
        //logger2.info("tweet.id_str:" + tweet.id_str.toString());
        text = text + "\n" + (temp2[tweet.id_str.toString()] != undefined ? temp2[tweet.id_str.toString()] : "");
        if ("urls" in tweet.entities && tweet.entities.urls.length > 0) {
            for (let i = 0; i < tweet.entities.urls.length; i++) {
                text = text.replace(tweet.entities.urls[i].url, tweet.entities.urls[i].expanded_url);
            }
        }
        //logger2.info(JSON.stringify(tweet.user));
        //if (retweeted == false) {
        payload.unshift(`[CQ:image,cache=0,file=file:///${await downloadx((nocheck == true ? (headpic2.replace("_normal", "_400x400")) : (headpic2.replace("_normal", "_bigger"))), ("headpic" + index), headpicshu1)}]\n${name}${useruid != -1 && retweeted == false ? "的twitter\n更新了" : "的twitter\n"}`, text);
        //}
        //是反着发的
        //logger2.info("payload:" + payload.join("\n"))
        return payload.join("\n");
    }
    catch (err) {
        logger2.error(new Date().toString() + ",推特format:" + err);
        //payload.push(`${tweet.user.name}的Twitter`, text);
        return "出错了";
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
                    logger2.info(JSON.stringify("置顶贴:" + timeline[0].user.pinned1[0]));
                    if (timeline[0].user.pinned1[0] == undefined) {
                        replyFunc(context, "该用户没有置顶的推特");
                    }
                    let temp = timeline[0].user.pinned1[0];// == timeline[0].user.pinned2[0] ? timeline[0].user.pinned1[0] : timeline[0].user.pinned2[0];
                    getSingleTweet(temp).then(tweet => {
                        format(tweet, -1, false, false, 0, 0, true).then(tweet_string => {
                            logger2.info("rtTimeline:" + tweet_string);
                            replyFunc(context, tweet_string + "\n" + `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
                            if (video3[temp.toString()] != undefined) {
                                replyFunc(context, video3[temp.toString()]);
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
                let temp = choose_one.user.screen_name1 == choose_one.user.screen_name2 ? choose_one.user.screen_name1 : choose_one.user.screen_name2;
                //choose_one.user = { name: user.name };
                format(choose_one).then(tweet_string => {
                    //logger2.info("choose_one:"+JSON.stringify(choose_one));
                    let payload = [tweet_string, `https://twitter.com/${temp}/status/${choose_one.id_str}`].join('\n\n');
                    replyFunc(context, payload);
                    if (video3[choose_one.id_str.toString()] != undefined) {
                        replyFunc(context, video3[choose_one.id_str.toString()]);
                    }
                    logger2.info("payload: " + payload);
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
        format(tweet, -1, false, true, 0, 0, true).then(tweet_string => {
            logger2.info("tweet_string:" + tweet_string);
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
    //logger2.info("name::" + name);
    let user = await searchUser(name);
    //logger2.info("user:" + JSON.stringify(user));
    if (!user) {
        replyFunc(context, "未发现该用户或者输入0-9之外的数字", true);
    } else {
        let option = OPTION_MAP[option_nl] || [1, 0, 0, 1];
        option = opt_dict(option);
        let user2 = {
            uid: user.id_str,
            name: user.name,
            screen_name: user.screen_name,
        }
        //logger2.info(JSON.stringify(user2));
        subscribe(user2, option, context);
    }
    return true;
}

async function twitterAggr(context) {
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
    else if (connection && /^订阅(推特|twitter)https:\/\/twitter.com\/.+(\/status\/\d+)?([>＞](仅转发|只看图|全部))?/i.test(context.message)) {
        let name = (/status\/\d+/.test(context.message) && /\.com\/(.+)\/status/.exec(context.message)[1] ||
            /\.com\/(.+)[>＞]/.exec(context.message)[1]);
        let option_nl = /[>＞](仅转发|只看图|全部)/.exec(context.message)[1];
        if (option_nl == undefined) option_nl = "仅原创"
        addSub(name, option_nl, context);
        return true;
    }
    else if (connection && /^订阅.+的?(推特|twitter)([>＞](仅转发|只看图|全部))?/i.test(context.message)) {
        let {
            groups: {
                name,
                option_nl
            }
        } = /订阅(?<name>.+)的?(推特|twitter)([>＞](?<option_nl>.{2,4}))?/i.exec(context.message);
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