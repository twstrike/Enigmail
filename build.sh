#!/usr/bin/env bash

export TB_PATH=${TB_PATH:-`which thunderbird`}
./configure #necessary for make clean
make clean
./configure --with-tb-path=$TB_PATH
make
