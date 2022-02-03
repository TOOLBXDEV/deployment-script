const { readFileSync } = require('fs')
const { Octokit } = require("octokit");

async function main () {
  // TODO: Store the access token more securely. For example, get it from macOS Keychain.
  const octokit = new Octokit({
    auth: readFileSync('github-personal-access-token', 'utf-8').trim()
  });

  const mergedPRs = (await octokit.rest.pulls.list({
    owner: 'TOOLBXDEV',
    repo: 'api-action-test',
    state: 'closed'
  })).data.filter(({ merged_at }) => merged_at);

  console.log('merged PRs are', mergedPRs);
}

main();
