const config = require('./config');
//const fileType = require('file-type');
const fs = require('fs');
const path = require('path');
//const download = require('download');
const logger2 = require('./logger2'); //日志功能
const axios = require('axios-https-proxy-fix');

//console.log(config);
const PROXY_CONF = config.default.proxy; //发现套了一个default。。！
var proxyip = false;
if (PROXY_CONF.host.length > 0 && PROXY_CONF.port !== 0) {
    proxyip = {
        host: PROXY_CONF.host,
        port: PROXY_CONF.port
    }
    //"http://" + PROXY_CONF.host + ":" + PROXY_CONF.port;
}

module.exports = async function Downloadx(url, name, i, pic = true) {
    logger2.info("下载文件 , " + url + " , " + name + " , " + i.toString());
    let path2 = path.join(__dirname, `../tmp/`);
    if (!fs.existsSync(path2)) {
        fs.mkdirSync(path2);
    }
    let fileType2 = "";
    if (pic == true) {
        fileType2 = "jpg";
    }
    else {
        fileType2 = "mp4";
    }
    const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        proxy: proxyip,
        timeout: 10000,
    }).catch(err => {
        logger2.info(new Date().toString() + ",获取下载资源失败:" + err);
        return false;
    });
    if (response != false) {
        //const imgType = fileType(await streamToBuffer(response.data)).ext;
        const mypath = path.resolve(path2, `${name + i.toString()}.${fileType2}`);
        const writer = fs.createWriteStream(mypath);
        response.data.pipe(writer);
        return await new Promise(async (resolve, reject) => {
            writer.on("finish",
                data => {
                    logger2.info(new Date().toString() + ",下载图片成功:" + JSON.stringify(data));
                    resolve(mypath);
                });
            writer.on("error",
                err => {
                    logger2.error(new Date().toString() + ",下载图片失败: " + JSON.stringify(err));
                    resolve("");
                });
        });
    } else {
        return "";
    }
}
