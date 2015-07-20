#!/bin/bash

set -e -x

source env.sh

npm install
npm prune
linklocal link -r &&
  linklocal list -r | bulk -c 'npm install'

electron-rebuild -f
bin/install-test-fixtures

set +x

if ! which fpcalc 2> /dev/null; then
  OS=`uname`
  if [[ "$OS" == "Darwin" ]] && which brew 2> /dev/null; then
    brew install chromaprint
  else
    echo 'WARNING: fpcalc not found in $PATH -- this is needed for adding music!' >&2
  fi
fi
