#!/usr/bin/env bash
./configure --enable-tests --with-tb-path=$(which thunderbird)
make
