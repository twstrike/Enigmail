#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99
export PL_PATH=`which perl`
export TB_PATH=${TB_PATH:-`which thunderbird`}

GNUPGHOME=$(mktemp -d $HOME/.gnupgXXXXXXTEST)
export GNUPGHOME

if [ "$#" -eq 0 ]; then
  util/run-tests.py
else
  util/run-tests.py $@
fi

RESULT=$?

killall Xvfb
rm -rf $GNUPGHOME
exit $RESULT
