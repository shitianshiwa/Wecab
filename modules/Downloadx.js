const config = require('./config');
const fileType = require('file-type');
const fs = require('fs');
const path = require('path');
const download = require('download');
const logger2 = require('./logger2'); //日志功能

//console.log(config);
const PROXY_CONF = config.default.proxy; //发现套了一个default。。！
var proxyip = false;
if (PROXY_CONF.host.length > 0 && PROXY_CONF.port !== 0) {
    proxyip = "http://" + PROXY_CONF.host + ":" + PROXY_CONF.port;
    //logger2.info(proxyip);
}
module.exports = async function Downloadx(url, name, i) {
    let fileDataArr = await new Promise(async function (resolve, reject) {
        logger2.info("下载文件 , " + url + " , " + name + " , " + i.toString());
        //logger2.info(proxyip != false ? proxyip : false);
        resolve(download(url, {
            proxy: proxyip != false ? proxyip : false
        }).catch(err => {
            logger2.error(new Date().toString() + " , " + err);
        }));
    });
    if (fileDataArr != null) {
        const imgType = fileType(fileDataArr).ext;
        const imgPath = path.join(__dirname, `../tmp/${name+i.toString()}.${imgType}`);
        fs.writeFileSync(imgPath, fileDataArr);
        logger2.info("完成下载");
        return imgPath;
    } else {
        return "";
    }
}