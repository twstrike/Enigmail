#!/usr/bin/env bash

Xvfb :99 >/dev/null 2>&1 &
export DISPLAY=:99

for f in `find . -type d -name 'tests'`; do
    pushd . > /dev/null
    cd $f
    make
    popd > /dev/null
done

killall Xvfb
