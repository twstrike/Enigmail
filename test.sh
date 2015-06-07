#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99
export PL_PATH=`which perl`
export TB_PATH=${TB_PATH:-`which thunderbird`}

GNUPGHOME=$(mktemp -d $HOME/.gnupgXXXXXXTEST)
if command -v realpath>/dev/null 2>&1; then
    CURRENT_FILE=`realpath "$0"`
else
    CURRENT_FILE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/$(basename $0)"
fi
WORKING_DIR=`dirname "$CURRENT_FILE"`

echo "pinentry-program $WORKING_DIR/pinentry-auto" >> $GNUPGHOME/gpg-agent.conf
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
