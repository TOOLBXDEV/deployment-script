#!/usr/bin/env bash
set -e

ORG="$1"
REPO="$2".git

if [[ ! -d "$REPO" ]]
then
  git clone --mirror git@github.com:"$ORG"/"$REPO"
fi

cd "$REPO"
git fetch
# https://stackoverflow.com/questions/7693249/how-to-list-commits-since-certain-commit
git rev-list --first-parent production..staging
