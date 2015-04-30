#!/usr/bin/env bash

display=$(ps aux | grep "[Xvfb] :" | awk '{print $12}')

export DISPLAY=$display
for f in `find . -type d -name 'tests'`; do 
    pushd . > /dev/null
    cd $f
    make
    popd > /dev/null
done
