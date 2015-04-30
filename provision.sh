#!/usr/bin/env bash 

echo "Provisioning ..."
apt-get update
apt-get install -y zip thunderbird xvfb
apt-get upgrade -y
wget -O /tmp/jsunit-0.1.xpi https://www.enigmail.net/jsunit/jsunit-0.1.xpi
rm -rf /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
unzip /tmp/jsunit-0.1.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
rm -rf '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
echo "/enigmail-src/build/dist" > '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
nohup Xvfb :99 >/dev/null 2>&1 &
