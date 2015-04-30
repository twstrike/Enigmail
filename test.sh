#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99
export PL_PATH=`which perl`

util/run-tests.py

RESULT=$?

killall Xvfb

exit $RESULT
