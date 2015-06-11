#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99
export PL_PATH=`which perl`
export TB_PATH=${TB_PATH:-`which thunderbird`}

if [ "$#" -eq 0 ]; then
  util/run-tests.py
else
  util/run-tests.py $@
fi

RESULT=$?

killall Xvfb
exit $RESULT
