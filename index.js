const { readFileSync } = require('fs')
const { Octokit } = require("octokit");

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

async function main () {
  const repos = JSON.parse(readFileSync('repositories.json', 'utf-8'));
  console.log('repos are', repos);

  // const mergedPRs = await fetchMergedPRs('api-action-test');
  // console.log('merged PRs are', mergedPRs);
}

main();
