#!/usr/bin/env bash
set -e

OWNER="$1"
REPO="$2".git
STAGING_REF="$3"
PRODUCTION_REF="$4"

if [[ ! -d "$REPO" ]]
then
  git clone --mirror git@github.com:"$OWNER"/"$REPO"
fi

cd "$REPO"
git fetch
# https://stackoverflow.com/questions/7693249/how-to-list-commits-since-certain-commit
git rev-list --first-parent "$PRODUCTION_REF".."$STAGING_REF"
