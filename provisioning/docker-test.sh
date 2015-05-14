#!/usr/bin/env bash

ENIGMAIL_SRC=`realpath ../Enigmail`

docker run -v $ENIGMAIL_SRC:/enigmail-src -i -t enigmail-unit ./test.sh
