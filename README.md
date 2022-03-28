## Introduction
This program will show you the pull requests between two refs and then let you trigger a GitHub Actions workflow on a repository. For this program to work correctly, the refs must exist on a branch which is advanced only via pull requests. That is, ideally this branch should be a [protected branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches#require-pull-request-reviews-before-merging).

## Requirements
- Bash
- Git
- Node.js

## Installation and Set-Up (Configuration)
- Clone this repository to anywhere in your machine.
- Change into this directory and run `npm install`.
- On GitHub, [create a personal access token](https://github.com/settings/tokens) with `repo` scope.

## Usage
This program requires the following command line arguments in the given order:
- GitHub Personal Access Token.
- Owner (organization or user) name on GitHub.
- Repository name on GitHub.
- GitHub Actions workflow ID (or file name) to trigger.
- Staging (latter) ref (branch or tag) to compare with the production (former) ref. This will also be the ref that the GitHub Actions workflow will be run at.
- Production ref to compare the staging ref with.

Since there are many arguments, the recommended way of using this program is creating a "wrapper script" that will call this program. For example, at TOOLBX, we are using [this script](https://github.com/TOOLBXDEV/deployment-script-toolbx/blob/master/deploy). Note that you can write the wrapper script in any language that you like. The fact that our wrapper script being in JavaScript is only coincidental.

## Notes
The first time that you run the program for a repository, it will take longer compared to the subsequent times, since the first run on a repository will clone the repository to your machine.
