#!/usr/bin/env bash

if command -v realpath>/dev/null 2>&1; then
    CURRENT_FILE=`realpath "$0"`
else
    CURRENT_FILE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/$(basename $0)"
fi
PROVISIONING_DIR=`dirname "$CURRENT_FILE"`
ENIGMAIL_ROOT=`dirname "$PROVISIONING_DIR"`

docker run -v $ENIGMAIL_ROOT:/enigmail-src -i -t enigmail-unit ./build.sh
