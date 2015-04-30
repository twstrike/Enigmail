#!/usr/bin/env bash

TBPATH=${TBPATH:-`which thunderbird`}
./configure --with-tb-path=$TBPATH
make
