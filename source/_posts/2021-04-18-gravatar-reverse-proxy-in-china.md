---
layout:     post
title:      "如何在墙内反代 Gravatar 显示博客头像"
author:     "刘文俊"
top: false
tags:
    - 独立博客
---

<blockquote class="blockquote-center">生命不息，折腾不止</blockquote>

[Gravatar](https://cn.gravatar.com/) 即全球通用头像 (Globally Recognized Avatar) 服务，用户只要在上面上传了自己的头像，那么在所有支持的网站上发帖时，只要提供与这个头像关联的 Email，就可以显示出自己的 Gravatar 头像。可以说是「一次上传，全网通用」~~

可惜国内的网络环境实在一言难尽，Gravatar 常年都处于无法访问的状态，所以本站一直都是用 v2ex 提供的 CDN 镜像，然而，就在前两周，v2ex 也被墙了，emm.... 因为不想再白嫖其他的国内镜像，因此开始考虑自己动手搭建。这个事情其实挺简单的，网上随便搜索一下就有答案，只要有一台墙外的 VPS，用 nginx 给 Gravatar 做个反向代理就好。

但是，如果你的主机在墙内呢，怎么办？

<!-- more -->

## 科学上网

无论如何，科学上网是第一件必须解决的事情。如果你的主机甚至都不能访问 Gravatar，反向代理根本就无从谈起。要实现科学上网，你首先需要在墙外有可用的 Shadowsocks 服务用于代理你的流量，至于是使用 VPS 自建也好、直接购买机场的服务也好，这里不作探讨。

安装 Shadowsocks：

```sh
apt-get install python-pip
pip install shadowsocks
```

在 `/etc/shadowsocks/config.json` 目录创建一个配置文件：

```json
{
  "server": "server_ip",         // 服务器地址
  "server_port": 8388,           // 服务器端口
  "local_address": "127.0.0.1",  // 本地 socks5 服务的监听地址
  "local_port": 1080,            // 本地 socks5 服务的监听端口
  "password": "password",        // 服务器密码
  "timeout": 300,                // 超时时间
  "method": "aes-256-gcm",       // 服务器加密方式
  "fast_open": false
}
```

配置完成后，使用 `sslocal` 命令启动客户端服务：

```sh
sslocal -c /etc/shadowsocks/config.json -d start
```

这个命令会在本地 1080 端口启动一个 socks5 代理，连接远程的 Shadowsocks 服务，把网络请求转发过去。

接下来检查一下这个代理是否可用，使用 `curl` 命令查询一下自己的 IP，`--socks5-hostname` 参数指定 socks5 代理服务的地址：

```sh
$ curl --socks5-hostname 127.0.0.1:1080 cip.cc
IP      : 104.xxx.xxx.xxx
地址    : 美国  加利福尼亚州  洛杉矶
运营商  : it7.net

数据二  : 美国 | 加利福尼亚州洛杉矶IT7网络

数据三  : 美国加利福尼亚

URL     : http://www.cip.cc/104.xxx.xxx.xxx
```

可以看到，IP 地址是国外的，证明我们已经可以科学上网了。

## 启动 socat 转发

照理说，实现科学上网之后，直接在 nginx 配置反向代理就能完成我们的任务。但遗憾的是，nginx 本身并不支持使用系统代理，也不像 `curl` 那样提供了 `--socks5-hostname` 参数用于显式指定代理，因此我们只能另谋出路。

这时我想到了 socat，socat 是一个多功能网络工具，它可以在两个网络数据流之间建立通道，实现端口转发的功能，同时还支持代理。但可惜的是，socat 目前只支持 socks4，还不支持 socks5，所以还不能直接用。在 GitHub 搜索发现已经有大佬给 socat 打过补丁，使其支持 socks5，因此决定使用这个补丁版本试试。这里给出项目的地址，有兴趣可以去点个 star：https://github.com/runsisi/socat

要安装这个补丁版的 socat，我们就不能直接使用 yum 或者 apt-get，而是要下载源码自己编译：

```sh
apt-get install git curl autoconf yodl make
git clone --depth=1 https://github.com/runsisi/socat.git
cd socat
autoconf
./configure --prefix=/usr
make
make install
```

> 注意，上面的第一步首先安装了编译的过程中需要用到的其他工具，其中 yodl 在 CentOs 中可能无法使用 yum 安装，也可以考虑通过下载源码自行编译的方式解决，项目地址：https://gitlab.com/fbb-git/yodl

安装之后，启动 socat，监听 1081 端口，把流量转发给 Gravatar，当然，需要走代理：

```sh
socat -d -d TCP4-LISTEN:1081,reuseaddr,fork SOCKS5:127.0.0.1:www.gravatar.com:443,socks5port=1080
```

尝试访问一下 1081 端口，发现已经可以正常获取到头像数据了：

```plain
$ curl -v -k -H 'Host: www.gravatar.com' -o /dev/null https://127.0.0.1:1081/avatar/123
* About to connect() to 127.0.0.1 port 1081 (#0)
*   Trying 127.0.0.1...
* Connected to 127.0.0.1 (127.0.0.1) port 1081 (#0)
> GET /avatar/123 HTTP/1.1
> User-Agent: curl/7.29.0
> Accept: */*
> Host: www.gravatar.com
>
< HTTP/1.1 200 OK
< Server: nginx
< Date: Thu, 22 Apr 2021 16:37:41 GMT
< Content-Type: image/jpeg
< Content-Length: 2637
< Connection: keep-alive
< Last-Modified: Wed, 11 Jan 1984 08:00:00 GMT
< Link: <https://www.gravatar.com/avatar/123>; rel="canonical"
< Access-Control-Allow-Origin: *
< Content-Disposition: inline; filename="123.jpg"
< Expires: Thu, 22 Apr 2021 16:42:41 GMT
< Cache-Control: max-age=300
< X-nc: HIT bur 3
< Accept-Ranges: bytes
<
{ [data not shown]
100  2637  100  2637    0     0   1172      0  0:00:02  0:00:02 --:--:--  1173
* Connection #0 to host 127.0.0.1 left intact
```

## 配置 nginx 反向代理

有了前面的准备工作之后，我们终于可以在 nginx 配置反向代理了，不过这里要注意的是，不能直接把流量转发给 Gravatar，而是转发给刚刚使用 socat 开启的本地 1081 端口。同时，为了减少回源的次数，提高访问速度，我们还可以做一层 `proxy_cache` 缓存。具体配置如下：

```nginx
http {
  proxy_cache_path  /var/cache/nginx levels=1:2 keys_zone=gravatar:8m max_size=10000m inactive=600m;
  proxy_temp_path   /var/cache/nginx/temp;

  server {
    listen          443;
    server_name     www.liuwj.me;
    ssl             on;

    location / {
      root          /var/www/www.liuwj.me;
    }
    location /gravatar/ {
      proxy_pass         https://localhost:1081/avatar/;
      proxy_set_header   Host www.gravatar.com;
      proxy_cache        gravatar;
      proxy_cache_valid  200 301 302 7d;
      proxy_cache_valid  404 502 1m;
      expires            7d;
    }
  }
}
```

配置完成后，尝试使用浏览器打开一个头像链接，确认是否能正常访问：https://www.liuwj.me/gravatar/123

大功告成！！一个头像请求，从浏览器发出之后，经过的路径应该是这样子的：

```plain
+---------+      +-------+      +-------+      +---------+      +----------+      +----------+
| browser | ---> | nginx | ---> | socat | ---> | sslocal | ---> | ssserver | ---> | gravatar |
+---------+      +-------+      +-------+      +---------+      +----------+      +----------+
```

可以说是十分曲折了...