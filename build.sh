#!/usr/bin/env bash

export TB_PATH=${TB_PATH:-`which thunderbird`}
./configure --with-tb-path=$TB_PATH
make
