#!/usr/bin/env bash

export TB_PATH=${TB_PATH:-`which thunderbird`}
make clean
./configure --with-tb-path=$TB_PATH
make
