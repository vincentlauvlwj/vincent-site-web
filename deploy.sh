#!/usr/bin/env bash
set -e

npx hexo clean && npx hexo generate

cp -r statics/* public

tar -czvf public.tar.gz public

scp public.tar.gz ecs-user@liuwj.me:~/public.tar.gz

ssh ecs-user@liuwj.me "tar -xzvf public.tar.gz && rm -rf /var/www/www.liuwj.me && mv public /var/www/www.liuwj.me && rm public.tar.gz"

rm public.tar.gz