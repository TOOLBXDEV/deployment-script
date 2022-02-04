const { promisify } = require('util');
const { readFileSync } = require('fs');
const { Octokit } = require("octokit");

const exec = promisify(require('child_process').exec);

// TODO: Store the access token more securely. For example, get it from macOS Keychain.
const octokit = new Octokit({
  auth: readFileSync('github-personal-access-token', 'utf-8').trim()
});

async function fetchMergedPRs(repoName, page = 1) {
  return (await octokit.rest.pulls.list({
    owner: 'TOOLBXDEV',
    repo: repoName,
    state: 'closed',
    page,
  })).data.filter(({ merged_at }) => merged_at);
}

/**
 * Get the list of commits that exist in staging, but do not exist in production. Since these are on
 * the master branch, all of these commits correspond to pull requests.
 */
async function fetchNewRefs(repo) {
  return (await exec(`./fetch-new-refs.sh ${repo}`)).stdout.trim().split('\n');
}

function getRepoFromArguments() {
  const repos = JSON.parse(readFileSync('repositories.json', 'utf-8'));
  const repo = process.argv[2];

  if (process.argv.length !== 3 || !repos.includes(repo)) {
    console.log('Please specify exactly one argument, which must be one of:');
    for (const repo of repos) {
      console.log(`- ${repo}`);
    }
    process.exit(1);
  }

  return repo;
}

async function main () {
  const repo = getRepoFromArguments();
  const newRefs = await fetchNewRefs(repo);
  console.log('newRefs are', newRefs);
  // const mergedPRs = await fetchMergedPRs(repo);
  // console.log('merged PRs are', mergedPRs);
}

main();
