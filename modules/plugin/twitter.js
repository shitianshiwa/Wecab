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
const fs = require('fs-extra');
const node_localStorage = require('node-localstorage');
const node_localStorage2 = node_localStorage.LocalStorage;
const wecab = new node_localStorage2('./wecab'); //插件是否连上机器人
const dayjs = require('dayjs');
const downloadx = require('../Downloadx'); //输入url，返回文件路径
const ClearDownloadx = require('../ClearDownloadx') //删除文件
const NodeCache = require('node-cache');

const config = require('../config');
//console.log(config);
//针对用户qq号的延时
const cache = new NodeCache({
    stdTTL: 1 * 5
});
//针对qq群的延时
const cache2 = new NodeCache({
    stdTTL: 1 * 5
});
const PROXY_CONF = config.default.proxy; //发现套了一个default。。！
const DB_PORT = 27017;
const DB_PATH = "mongodb://127.0.0.1:" + DB_PORT;
const BEARER_TOKEN = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const MAX_SIZE = 30 * 1024 * 1024; //图片最大体积
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

let guest_token = "";
let cookie = "";
let connection = true;
let replyFunc = (context, msg, at = false) => {
    //logger2.info("推特：" + msg)
};
var proxy2 = false;
if (PROXY_CONF.host.length > 0 && PROXY_CONF.port !== 0) {
    proxy2 = {
        host: PROXY_CONF.host,
        port: PROXY_CONF.port
    }
}

//var axios = null;

//是否启用代理访问推特
/*function setAgent() {
    if (PROXY_CONF.host.length > 0 && PROXY_CONF.port !== 0) {
        axios = Axios.create({
            proxy: {
                host: PROXY_CONF.host,
                port: PROXY_CONF.port,
            }
        });
    } else axios = Axios;
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
    for (key in OPTION_MAP) {
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

/** 检查网络情况，如果连不上twitter那后面都不用做了*/
function checkConnection() {
    return axios({
        method: "GET",
        url: "https://twitter.com",
        //是否启用代理访问推特
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36"
        },
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        connection = (res.status == 200) ? true : false
    }).catch(err => {
        logger2.error(new Date().toString() + ",Twitter checkConnection error with" + " , " + err.response.status + " , " + err.response.statusText);
        return false;
    });
}

function firstConnect() {
    checkConnection().then(() => {
        if (!connection) {
            logger2.info(new Date().toString() + ",twitter无法连接，功能暂停");
        } else {
            getGuestToken();
            setTimeout(() => getCookie(), 1000); //cookie有时间限制
            let get_cookie_routine = setInterval(() => getCookie(), 20 * 60 * 60 * 1000);
            let get_gt_routine = setInterval(() => getGuestToken(), 0.9 * 60 * 60 * 1000);
        }
    });
}

function sizeCheck(url) {
    return axios({
        method: "GET",
        url: url,
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        return parseInt(res.headers["content-length"]) < MAX_SIZE ? true : false;
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特0：" + url + "," + err);
        return false;
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
    }).catch(err => logger2.info(new Date().toString() + ",推特1：" + err.response.data))
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
 * 获取单条twitter参考  
 * developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-lookup
 * @param {string} tweet_id_str 单条Tweet id
 * @returns {Promise} Tweet Object，如果错误，结果为false
 */
function getSingleTweet(tweet_id_str) {
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
function getUserTimeline(user_id, count = 2, include_rt = false, exclude_rp = true, since_id = "1") {
    return axios({
        method: 'GET',
        url: "https://api.twitter.com/1.1/statuses/user_timeline.json",
        headers: {
            "Authorization": BEARER_TOKEN
        },
        params: {
            // screen_name : screen_name,
            "user_id": user_id,
            "count": count,
            "exclude_replies": exclude_rp,
            "include_rts": include_rt,
            "tweet_mode": "extended",
            since_id: since_id
        },
        //是否启用代理访问推特
        proxy: proxy2,
        timeout: 10000
    }).then(res => {
        return res.data;
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特3：" + JSON.stringify(err.response.data));
        //error: Fri Oct 16 2020 07:02:20 GMT+0800 (GMT+08:00),推特3：{"errors":[{"message":"Internal error","code":131}]}
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
function searchUser(name) {
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
        return res.data[0]
    }).catch(err => {
        logger2.info(new Date().toString() + ",Twitter searchUser error：" + err.response.data);
        return false;
    })
}

/** 
 * 
 * @param {string} name 用户名称
 * @returns {Promise} user_object，如果没有或者错误会返回false
 */
function fetch(name) {
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
        return res.data[0]
    }).catch(err => {
        logger2.error(new Date().toString() + ",推特5：" + err.response.data);
        return false;
    })
}

/**
 * 增加订阅
 * @param {number} uid twitter用户id_str
 * @param {string} option 偏好设置
 * @param {object} context
 */
function subscribe(uid, option, context) {
    let group_id = context.group_id;
    let option_nl = toOptNl(option);

    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let coll = mongo.db('bot').collection('twitter');
        let res = await coll.find({
            uid: uid
        }).toArray();
        if (res.length == 0) {
            let tweet = (await getUserTimeline(uid, 15, true))[0];
            if (tweet == undefined) {
                replyFunc(context, `无法订阅该twitter`, true);
                return false;
            }
            let tweet_id = tweet.id_str;
            let name = tweet.user.name;
            coll.insertOne({
                    uid: uid,
                    name: name,
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
 * @param {string} uid twitter用户id
 * @param {object} context
 */
// * @param {string} name twitter用户名

function unSubscribe(uid, context) {
    let group_id = context.group_id;
    //let name_reg = new RegExp(name, 'i')
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
                if (err) logger2.error(new Date().toString() + ",推特：" + err + ",database subscribes delete error");
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
 * 每过x分钟检查一次订阅列表，如果订阅一个twitter账号的群的数量是0就删除
 */
function checkTwiTimeline() {
    if (!connection) return;
    //return; //未做测试警告
    let firish = false;
    let check_interval = 7 * 60 * 1000; //6分钟一次
    let check_interval2 = 10000; //api调用延时 10秒
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
                subscribes != undefined ? "" /*logger2.info("推特订阅数：" + subscribes.length)*/ : logger2.error(new Date().toString() + ",twitter database error")
            }
            mongo.close();

            function checkEach() {
                if (subscribes[i] == undefined) {
                    return;
                }
                setTimeout(async () => {
                    try {
                        let ii = new Array();
                        let tweet_list = await getUserTimeline(subscribes[i].uid, 10, true, false);
                        if (tweet_list != undefined) {
                            let last_tweet_id = subscribes[i].tweet_id; //最新一条推特id
                            let current_id = tweet_list[0].id_str;
                            if (current_id > last_tweet_id) {
                                let groups = subscribes[i].groups;
                                for (let tweet of tweet_list) {
                                    if (tweet.id_str > last_tweet_id) { //每一个推，一次发完所有订阅的群，直到所有推特发完
                                        groups.forEach(group_id => {
                                            if (ii[group_id] == undefined) {
                                                ii[group_id] = 1;
                                            }
                                            if (checkOption(tweet, subscribes[i][group_id])) {
                                                format(tweet, subscribes[i].uid).then(payload => {
                                                    payload = ii[group_id] + "\n" + payload;
                                                    payload += `\nhttps://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
                                                    replyFunc({
                                                        group_id: group_id,
                                                        message_type: "group"
                                                    }, payload);
                                                    replyFunc({
                                                        group_id: group_id,
                                                        message_type: "group"
                                                    }, ii[group_id] + `, https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
                                                    ii[group_id] = ii[group_id] + 1;
                                                }).catch(err => logger2.error(new Date().toString() + ",推特6：" + err));
                                            }
                                        });
                                    }
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
                                            if (err) logger2.error(new Date().toString() + ",推特：" + err + ",database update error during checktwitter");
                                            mongo.close();
                                        });
                                });
                            }
                        }
                    } catch (err) {
                        logger2.error(new Date().toString() + ",推特：" + err + ',' + JSON.stringify(subscribes[i]));
                    } finally {
                        i++;
                        if (i < subscribes.length) checkEach();
                        else firish = false;
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

//查看推特订阅列表
/**
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
 * @param {object} context
 * @returns {} no return
 */
function clearSubs(context, group_id) {
    mongodb(DB_PATH, {
        useUnifiedTopology: true
    }).connect().then(async mongo => {
        let coll = mongo.db('bot').collection('twitter');
        try {
            let matchs = await coll.find({
                groups: {
                    $in: [group_id]
                }
            }).toArray();
            if (matchs.length < 1) {
                replyFunc(context, `未见任何twitter订阅`);
                return;
            }
            for (let item of matchs) {
                let res = await coll.findOneAndUpdate({
                    _id: item._id
                }, {
                    $pull: {
                        groups: {
                            $in: [group_id]
                        }
                    },
                    $unset: {
                        [group_id]: []
                    }
                }, {
                    returnOriginal: false
                });
                if (res.value.groups.length < 1) await coll.deleteOne({
                    _id: res.value._id
                });
            }
            replyFunc(context, `清理了${matchs.length}个twitter订阅`);
        } catch (err) {
            logger2.error(new Date().toString() + ",推特清理订阅：" + err);
            replyFunc(context, '中途错误，清理未完成');
        } finally {
            mongo.close();
        }
    }).catch(err => logger2.error(new Date().toString() + ":" + err + ",twitter clearSubs error, group_id= " + group_id));
}

/**
 * 整理tweet_obj
 * @param {object} tweet Tweet object
 * @param {string} from_user twitter用户名
 * @returns Promise  排列完成的Tweet String
 */
async function format(tweet, useruid = -1, end_point = false, retweeted = false) {
    let payload = [];
    let text = "";
    if ('full_text' in tweet) text = tweet.full_text;
    else text = tweet.text;
    if ("retweeted_status" in tweet) {
        let rt_status = await format(tweet.retweeted_status, -1, false, true)
        payload.push(`来自${tweet.user.name}${useruid!=-1&retweeted==false?"(推特用户id："+useruid+")的twitter\n转推了":""}`, rt_status);
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
                        pics += await sizeCheck(src) ? `[CQ:image,cache=0,file=file:///${await downloadx(src,"photo",i)}]` : `[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https,"photo",i)}] 注：这不是原图`;
                        logger2.info("src:" + src + " , media[i].media_url_https:" + media[i].media_url_https);
                    } else if (media[i].type == "animated_gif") {
                        try {
                            logger2.info("media[i].video_info.variants[0].url:" + media[i].video_info.variants[0].url);
                            await exec(`ffmpeg -i ${await downloadx(media[i].video_info.variants[0].url,"animated_gif",i)} -loop 0 -y ${__dirname}/temp.gif`)
                                .then(async ({
                                    stdout,
                                    stderr
                                }) => {
                                    if (stdout.length == 0) {
                                        if (fs.statSync(`${__dirname}/temp.gif`).size < MAX_SIZE) { //帧数过高可能发不出来gif,gif和插件模块放在一块，不在tmp文件夹里
                                            //let gif = fs.readFileSync(`${__dirname}/temp.gif`);
                                            //let base64gif = Buffer.from(gif, 'binary').toString('base64');
                                            pics += `这是一张动图 [CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https,"animated_gif",i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`
                                            pics += `[CQ:image,file=file:///${__dirname}/temp.gif]`;
                                            //pics += `[CQ:image,file=base64://${base64gif}]`;
                                            //console.log(__dirname + "/temp.gif");
                                            //pics += `[CQ:image,file=file:///${__dirname}/temp.gif]`;
                                        } else pics += `这是一张动图 [CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https,"animated_gif",i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
                                    }
                                })
                        } catch (err) {
                            logger2.error(new Date().toString() + ",推特动图：" + err);
                            pics += `这是一张动图 [CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https,"animated_gif",i)}]` + `动起来看这里${media[i].video_info.variants[0].url}`;
                        }
                        logger2.info("media[i].media_url_https:" + media[i].media_url_https);
                    } else if (media[i].type == "video") {
                        let mp4obj = [];
                        for (let j = 0; j < media[i].video_info.variants.length; j++) {
                            if (media[i].video_info.variants[j].content_type == "video/mp4") mp4obj.push(media[i].video_info.variants[j]);
                        }
                        mp4obj.sort((a, b) => {
                            return b.bitrate - a.bitrate;
                        });
                        logger2.info("media[i].media_url_https:" + media[i].media_url_https);
                        payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(media[i].media_url_https,"video",i)}]`,
                            `视频地址: ${mp4obj[0].url}`);
                    }
                }
            }
        }
        if (pics != "") payload.push(pics);
    }
    if ("is_quote_status" in tweet && tweet.is_quote_status == true) {
        let quote_tweet = await getSingleTweet(tweet.quoted_status_id_str);
        payload.push("提到了", await format(quote_tweet, -1, false, true));
        text = text.replace(tweet.quoted_status_permalink.url, "");
    }
    if ("in_reply_to_status_id" in tweet && tweet.in_reply_to_status_id != null && !end_point) {
        let reply_tweet = await getSingleTweet(tweet.in_reply_to_status_id_str);
        payload.push("回复了", await format(reply_tweet, -1, false, true));
    }
    let ii = 0;
    if ("card" in tweet) {
        // payload.push(tweet.binding_values.title.string_value, urlExpand(card.url));
        if (/poll\dchoice/.test(tweet.card.name)) {
            let i = 0;
            if ("image_large" in tweet.card.binding_values) {
                logger2.info("tweet.card.binding_values.image_large.url:" + tweet.card.binding_values.image_large.url);
                payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.image_large.url,"image_large",i)}]`);
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
            //console.log(end_time);
            //console.log(new Date(tweet.card.binding_values.end_datetime_utc.string_value).toString());
            //console.log(tweet.card.binding_values.end_datetime_utc.string_value);

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
        } else if (/summary/.test(tweet.card.name)) {
            if ("photo_image_full_size_original" in tweet.card.binding_values) {
                if (sizeCheck(tweet.card.binding_values.photo_image_full_size_original.image_value.url)) {
                    logger2.info("tweet.card.binding_values.photo_image_full_size_original.image_value.url:" + tweet.card.binding_values.photo_image_full_size_original.image_value.url);
                    payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_original.image_value.url,"photo_image_full",ii)}]`);
                } else {
                    logger2.info("tweet.card.binding_values.photo_image_full_size_large.image_value.url:" + tweet.card.binding_values.photo_image_full_size_large.image_value.url);
                    payload.push(`[CQ:image,cache=0,file=file:///${await downloadx(tweet.card.binding_values.photo_image_full_size_large.image_value.url,"photo_image_full",ii)}]`);
                }
                ii++;
            }
            payload.push(tweet.card.binding_values.title.string_value, tweet.card.binding_values.description.string_value);
        }
    }
    if ("urls" in tweet.entities && tweet.entities.urls.length > 0) {
        for (let i = 0; i < tweet.entities.urls.length; i++) {
            text = text.replace(tweet.entities.urls[i].url, tweet.entities.urls[i].expanded_url);
        }
    }
    payload.unshift(`${tweet.user.name}${useruid!=-1&retweeted==false?"(推特用户id："+useruid+")的twitter\n更新了":""}`, text);
    return payload.join("\n");
}

/**
 * 将twitter的t.co短网址扩展为原网址
 * @param {string} twitter_short_url twitter短网址
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
        logger2.error(new Date().toString() + ",推特7：" + err.response.data);
        return false;
    });
}

function rtTimeline(context, name, num) {
    searchUser(name).then(user => {
        if (!user) replyFunc(context, "未找到该推特");
        else if (user.protected == true) replyFunc(context, "该twitter受到保护，无法浏览");
        else {
            getUserTimeline(user.id_str, 20).then(async timeline => {
                if (timeline.length - 1 < num) timeline = await getUserTimeline(user.id_str, 50);
                if (timeline.length - 1 < num) timeline = await getUserTimeline(user.id_str, 1, true, false);
                format(timeline[num]).then(tweet_string => {
                    let payload = [tweet_string, `https://twitter.com/${user.screen_name}/status/${timeline[num].id_str}`].join('\r\n\r\n');
                    replyFunc(context, payload);
                }).catch(err => logger2.error(new Date().toString() + ",推特rtTimeline：" + err));
                //error: Fri Oct 16 2020 07:02:20 GMT+0800 (GMT+08:00),推特rtTimeline：TypeError: Cannot use 'in' operator to search for 'full_text' in undefined
            });
        }
    });
}

function rtSingleTweet(tweet_id_str, context) {
    getSingleTweet(tweet_id_str).then(tweet => {
        format(tweet).then(tweet_string => {
            logger2.info(tweet_string);
            replyFunc(context, tweet_string);
        })
    });
}

/**
 * 通过用户名添加订阅
 * @param {string} name twitter用户名
 * @param {string} option_nl 偏好设置，可以是"仅原创"，"包含转发"，"仅带图"
 * @param {object} context
 * @returns {boolean} 成功返回true
 */
async function addSubByName(name, option_nl, context) {
    let user = await searchUser(name);
    if (!user) {
        replyFunc(context, "未发现该用户或者输入0-9之外的数字", true);
        return true;
    } else {
        let option = OPTION_MAP[option_nl] || [1, 0, 0, 1];
        option = opt_dict(option);
        subscribe(user.id_str, option, context);
        return true;
    }
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
    if (connection && /^看看(.+?)的?((第[0-9]?[一二三四五六七八九]?条)|(上*条)|(最新))?\s?(推特|twitter)$/i.test(context.message)) {
        let num = 1;
        let name = "";
        if (/最新/.test(context.message))(num = 0);
        else if (/上上上条/.test(context.message))(num = 3);
        else if (/上上条/.test(context.message))(num = 2);
        else if (/上一?条/.test(context.message))(num = 1);
        else if (/第.+?条/.test(context.message)) {
            let temp = /第([0-9]|[一二三四五六七八九])条/.exec(context.message);
            if (temp != null) {
                temp = temp[1];
            } else {
                temp = 0;
            }
            if (temp == 0 || temp == "零")(num = 0);
            else if (temp == 1 || temp == "一")(num = 0);
            else if (temp == 2 || temp == "二")(num = 1);
            else if (temp == 3 || temp == "三")(num = 2);
            else if (temp == 4 || temp == "四")(num = 3);
            else if (temp == 5 || temp == "五")(num = 4);
            else if (temp == 6 || temp == "六")(num = 5);
            else if (temp == 7 || temp == "七")(num = 6);
            else if (temp == 8 || temp == "八")(num = 7);
            else if (temp == 9 || temp == "九")(num = 8);
        } else num = 0;
        name = /看看(.+?)的?((第[0-9]?[一二三四五六七八九]?条)|(上{1,3}一?条)|(置顶)|(最新))?\s?(推特|twitter)/i.exec(context.message)[1];
        rtTimeline(context, name, num);
        return true;
    } else if (connection && /^看看https:\/\/(mobile\.)?twitter.com\/.+?\/status\/(\d+)/i.test(context.message)) {
        let tweet_id = /status\/(\d+)/i.exec(context.message)[1];
        rtSingleTweet(tweet_id, context);
        return true;
    } else if (connection && /^订阅(推特|twitter)https:\/\/twitter.com\/.+(\/status\/\d+)?([>＞](仅转发|只看图|全部))?/i.test(context.message)) {
        let name = (/status\/\d+/.test(context.message) && /\.com\/(.+)\/status/.exec(context.message)[1] ||
            /\.com\/(.+)[>＞]/.exec(context.message)[1]);
        let option_nl = /[>＞](仅转发|只看图|全部)/.exec(context.message)[1];
        if (option_nl == undefined) option_nl = "仅原创"
        addSubByName(name, option_nl, context);
        return true;
    } else if (connection && /^订阅.+的?(推特|twitter)([>＞](仅转发|只看图|全部))?/i.test(context.message)) {
        let {
            groups: {
                name,
                option_nl
            }
        } = /订阅(?<name>.+)的?(推特|twitter)([>＞](?<option_nl>.{2,4}))?/i.exec(context.message);
        addSubByName(name, option_nl, context);
        return true;
    } else if (/^取消订阅.+的?(推特|twitter)$/i.test(context.message)) {
        let uid = /取消订阅(.+)的?(推特|twitter)/i.exec(context.message)[1];
        unSubscribe(uid, context);
        return true;
    } else if (/^查看(推特|twitter)订阅$/i.test(context.message)) {
        checkSubs(context); //Twitter==twitter什么情况？
        return true;
    } else if (/^清空(推特|twitter)订阅$/i.test(context.message)) {
        if (/owner|admin/.test(context.sender.role)) clearSubs(context, context.group_id);
        else replyFunc(context, '无权限');
        return true;
    } else return false;
}
//setAgent();
firstConnect();

module.exports = {
    twitterAggr,
    twitterReply,
    checkTwiTimeline,
    clearSubs
};