const canvas = require('canvas');
const logger2 = require('../logger2'); //日志功能
const probe = require('probe-image-size');
//https://www.npmjs.com/package/probe-image-size
//const picsize = require('image-size');
/*分享一个npm包，用来获取image的宽高
https://www.npmjs.com/package/image-size

var sizeOf = require('image-size');
var dimensions = sizeOf('images/funny-cats.png');
console.log(dimensions.width, dimensions.height);
https://blog.csdn.net/gswwxyhk/article/details/109268163
*/
canvas.registerFont('simhei.ttf', {
    family: 'SimHei'
});
const context = canvas.createCanvas(1, 1).getContext("2d");
context.font = "400 32px SimHei";
async function counterfeit(context, replyFunc, bot) {
    try {
        if (context.message.length > 500) {
            replyFunc(context, "文字内容超过500字符");
            return true;
        } else if ( /*/\[CQ:image/.test(context.message) || */ /\[CQ:face/.test(context.message)) {
            replyFunc(context, "暂不支持插入表情");
            return true;
        }
        let user_id = context.user_id; //发消息的qq
        let other_id = /\[CQ:at,qq=(\d+)\]/.exec(context.message); //at别人的qq
        if (other_id != null) {
            other_id = other_id[1]; //得到别人的qq
        }
        let member_info = context.sender;
        let hasimg = false;
        let member_info2 = null;
        let name = null; //昵称
        if (other_id == null) {
            //console.log(member_info);
            name = member_info.card ? member_info.card : member_info.nickname;
        } else {
            //console.log(other_id);
            member_info2 = await bot("get_group_member_info", { //不能获取自己QQ的信息 { data: null, retcode: 102, status: 'failed' }
                user_id: other_id,
                group_id: context.group_id,
            });
            //console.log(member_info2);
            if (!member_info2 || member_info2.status != "ok") throw 3;
            name = member_info2.data.card ? member_info2.data.card : member_info2.data.nickname;
            user_id = other_id; //有at别人就用别人的qq号替换自己qq号
        }
        if (!name) throw 4;
        if (name.length > 25) name = name.substring(0, 25) + "..."; //限制昵称长度
        let message = context.message.substr(4); //排除最开头的4个字符
        //console.log(message);
        if (!message) throw 5;
        if (hasImage(message) == true) { //判断有没有图片
            hasimg = true;
        }
        let imgurl = getImgs(message); //获取图片链接
        if (imgurl.length > 1) {
            replyFunc(context, "只能插入一张图片");
            return true;
        }
        //message = message.replace(/\[CQ\:image.*?\]/g, "");
        //message = message.replace(/\[CQ\:at.*?\]/g, "");
        message = message.replace(/\[CQ\:.*?\]/g, ""); //清除所有cq码
        if (message == "") {
            message = " ";
        }
        /*const raw = await canvas.loadImage(`${__dirname}/qq_chat.jpg`);
        const base = canvas.createCanvas(raw.width, raw.height);
        let ctx = base.getContext("2d");
        ctx.drawImage(raw, 0, 0);*/
        //let message = /(?:(?<!CQ)[:：](.+)|['"‘“](.+?)['"’”]$)/.exec(message);
        //if (!message) throw 4;
        //else message = message.filter((noEmpty) => {
        //    return noEmpty != undefined
        //})[1];
        message = getshorttest(message.replace(/\r\n/g, "\n")).replace(/\n/g, "<br>").split("<br>"); //指定长度换行+切割字符串
        let len_list = [];
        for (let i in message) {
            let lines = [];
            for (let index = 0; index < message[i].length; index++) {
                let line = "";
                let length = 0;
                while (length < 30 && index < message[i].length) {
                    let char = message[i].charAt(index);
                    if (/[\x00-\xff]/.test(char)) length++;
                    else length += 2;
                    line += char;
                    index++;
                }
                lines.push(line);
                len_list.push(length);
            }
            message[i] = lines;
        }
        message = message.flat();
        // 背景
        const longest = 16 * Math.max(...len_list);
        const text_width = longest + 130 + 100;
        const name_width = name.length * 21 + 135;
        let width2 = text_width > name_width ? text_width : name_width;
        if (width2 > 830) width2 = 830;
        let height2 = 145 + 35 * message.length + 50;
        let temp = await probe(imgurl[0].url);
        logger2.info(JSON.stringify(temp));
        let width = 200;
        let height = 200;
        if (temp.width != temp.height) {//不等长宽才处理
            height = 200 * (temp.width < temp.height ? temp.height / temp.width : (temp.width == temp.height ? 200 : temp.height / temp.width));
        }
        if (hasimg == true) {
            width2 = width2 + 100;
            height2 = height2 + height;
        }
        const base = canvas.createCanvas(width2 + 50, height2);
        let ctx = base.getContext("2d");
        ctx.fillStyle = "#ECECF6";
        ctx.fillRect(0, 0, width2 + 50, height2);

        // 画气泡
        const bubble = {
            x: 130,
            y: 78,
            width: hasimg == true ? (longest <= 220 ? 250 : longest + 50) : longest + 100,
            height: hasimg == true ? (35 * message.length > 252 ? 35 * message.length + 250 : height + 35 * message.length + 60) : 35 * message.length + 100,
            r: 30
        };
        ctx.beginPath();
        ctx.moveTo(bubble.x + bubble.r, bubble.y);
        ctx.arcTo(bubble.x + bubble.width, bubble.y, bubble.x + bubble.width, bubble.y + bubble.height, bubble.r);
        ctx.arcTo(bubble.x + bubble.width, bubble.y + bubble.height, bubble.x, bubble.y + bubble.height, bubble.r);
        ctx.arcTo(bubble.x, bubble.y + bubble.height, bubble.x, bubble.y, bubble.r);
        ctx.arcTo(bubble.x, bubble.y, bubble.x + bubble.width, bubble.y, bubble.r);
        ctx.closePath();
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();

        // 填充名字
        ctx.fillStyle = "#959595";
        ctx.font = "800 20px Source Han Sans SC";
        ctx.fillText(name, 136, 60);

        // 填充文字
        ctx.fillStyle = "#000000";
        ctx.font = "400 32px SimHei";
        message = getshorttest(message.join("\n"));
        ctx.fillText(message, 148, 128);

        // 填充头像
        let head = await canvas.loadImage(`http://q1.qlogo.cn/g?b=qq&s=100&nk=${user_id}`);
        if (!head) throw 1;
        let round_head = canvas.createCanvas(head.width, head.height);
        let head_ctx = round_head.getContext("2d");

        // 把头像弄圆
        head_ctx.beginPath();
        head_ctx.arc(89 / 2, 89 / 2, 89 / 2, 0, Math.PI * 2, false);
        head_ctx.fill()
        head_ctx.closePath();
        head_ctx.clip();

        head_ctx.drawImage(head, 0, 0, 89, 89);
        ctx.drawImage(head_ctx.canvas, 29, 29, 89, 89);

        //填充图片
        if (imgurl.length == 1) {
            let pic = await canvas.loadImage(imgurl[0].url);
            if (!pic) throw 1;
            ctx.drawImage(pic, 148, 128 + getTextHeigth(message), width, height);
        }

        // 出图
        const img64 = base.toBuffer("image/jpeg", {
            quality: 1
        }).toString("base64");
        replyFunc(context, `[CQ:image,file=base64://${img64}]`);
        return true;
    } catch (err) {
        replyFunc(context, "出错惹");
        logger2.error("iHaveAfriend," + new Date().toString() + ":" + err);
    }
}

function deal(context, replyFunc, bot) {
    if (/^合成文本.*/.test(context.message)) {
        counterfeit(context, replyFunc, bot)
    } else return false;
}

function getshorttest(text) {
    let len = 20;
    let temp,
        temp2 = "",
        temp3 = 0;
    text = text.replace(/\n/g, "");
    text = text.split("\n");
    let i, i2, i3, i4, i5;
    for (i = 0; i < text.length; i++) {
        temp = "";
        i4 = len; //一行60字
        i5 = 0; //切割字符串初始位置
        if (text[i].length > len) {
            for (i2 = 0; i2 < parseInt(text[i].length / len); i2++) { //判断切割几次字符串`
                temp3 = text[i].length - (text[i].length - i4);
                //console.log(text[i].length + " ,temp3:" + temp3)
                for (i3 = i5; i3 < temp3; i3++) { //获取指定分段字符串
                    temp = temp + text[i][i3];
                }
                temp += "\n"; //增加换行
                i5 = i4; //切割开头
                i4 += len; //切割结尾
            }
            for (i3 = len * parseInt(text[i].length / len); i3 < text[i].length; i3++) { //补上最后一部分字符串，解决丢失
                temp = temp + text[i][i3];
            }
            temp += "\n"; //增加换行
        } else {
            temp = text[i] + "\n";
        }
        temp2 += temp;
    }
    return temp2;
}

/**
 * https://blog.csdn.net/u012860063/article/details/53105658
 * JS 计算任意字符串宽度
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 * 
 * @param {String} text The text to be rendered.
 * 
 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
function getTextWidth(text) {
    return context.measureText(text).width + 100;
}

/**
 * JS 计算任意字符串大致高度
 * @param {String} text The text to be rendered.
 * 
 */
function getTextHeigth(text) {
    let jishu = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] == "\n") {
            jishu++; //计算多少行
        }
    }
    return 30 * jishu;
}




/**
 * 从消息中提取图片
 *
 * @param {string} msg
 * @returns 图片URL数组
 */
function getImgs(msg) {
    const reg = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/g;
    const result = [];
    /*if(msg.search("  ")!=-1)
    {
        Logger.info("可能是替身搜图？");
        return result;//尝试解决"替身"搜图 回复AT机器人的消息搜图
    }*/
    let search = reg.exec(msg);
    while (search) {
        result.push({
            file: search[1],
            url: search[2],
        });
        search = reg.exec(msg);
    }
    return result;
}

/**
 * 判断消息是否有图片
 *
 * @param {string} msg 消息
 * @returns 有则返回true
 */
function hasImage(msg) {
    return msg.indexOf('[CQ:image') !== -1;
}

module.exports = {
    deal
};