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
  const mergedPRs = await fetchMergedPRs(repo);
  console.log('merged PRs are', mergedPRs);
}

main();
