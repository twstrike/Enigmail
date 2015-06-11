#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99
./configure --enable-tests --with-tb-path=$(which thunderbird)
make
