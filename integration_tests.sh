#!/bin/sh

# Get directory where this script resides, cd there.
# This allows the script to be run from elsewhere.
pushd $(dirname $(readlink -f $0)) >/dev/null

OUTPUT="--with-xunit --xunit-file=test-reports/phantomjs.xml"

nosetests -v -m '^test_' $OUTPUT splinter_tests/ 2>&1 |less

popd
