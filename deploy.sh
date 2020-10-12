#!/usr/bin/env bash
set -e

hexo clean && hexo generate

cp -r statics/* public

zip -r vincent-site-web.zip ./public

scp vincent-site-web.zip root@liuwj.me:~/vincent-site-web.zip

ssh root@liuwj.me "unzip vincent-site-web.zip && rm -rf /var/www/www.liuwj.me && mv public /var/www/www.liuwj.me && rm vincent-site-web.zip"

rm vincent-site-web.zip