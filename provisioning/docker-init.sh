#!/usr/bin/env bash

CURRENT_FILE=`realpath "$0"`
PROVISIONING_DIR=`dirname "$CURRENT_FILE"`
ENIGMAIL_ROOT=`dirname "$PROVISIONING_DIR"`

pushd .
cd $PROVISIONING_DIR

docker build -t enigmail-unit .

popd
