#!/usr/bin/env bash

for f in `find . -type d -name 'tests'`; do 
    pushd . > /dev/null
    cd $f
    make
    popd > /dev/null
done