#!/usr/bin/env bash

CURRENT_FILE=`realpath "$0"`
PROVISIONING_DIR=`dirname "$CURRENT_FILE"`
ENIGMAIL_ROOT=`dirname "$PROVISIONING_DIR"`

docker run -v $ENIGMAIL_ROOT:/enigmail-src -i -t enigmail-unit ./test.sh "$@"
