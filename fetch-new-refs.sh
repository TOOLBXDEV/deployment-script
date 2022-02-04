#!/usr/bin/env bash
set -e

REPO="$1".git

if [[ ! -d "$REPO" ]]
then
  git clone --mirror git@github.com:TOOLBXDEV/"$REPO"
fi

cd "$REPO"
git fetch
# https://stackoverflow.com/questions/7693249/how-to-list-commits-since-certain-commit
git rev-list --first-parent production..staging
