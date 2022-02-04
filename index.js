const { promisify } = require('util');
const { readFileSync } = require('fs');
const { Octokit } = require("octokit");

const exec = promisify(require('child_process').exec);

// TODO: Store the access token more securely. For example, get it from macOS Keychain.
const octokit = new Octokit({
  auth: readFileSync('github-personal-access-token', 'utf-8').trim()
});

async function fetchMergedPRs(repoName, page) {
  return (await octokit.rest.pulls.list({
    owner: 'TOOLBXDEV',
    repo: repoName,
    state: 'closed',
    // 100 is the max value: https://docs.github.com/en/rest/reference/pulls#list-pull-requests
    per_page: 100,
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
  const repos = JSON.parse(readFileSync('repos.json', 'utf-8'));
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

/**
 * Find the PRs that are merged after the deployment to production, but before deployment to
 * staging. This way, we will understand which PRs will actually be deployed to production.
 *
 * To do so, starting from the latest merged PR and going back chronologically, we will:
 *
 * - Find the first PR that exist in staging. The first (couple) PRs are potentially not in staging,
 *   since their deployment to staging might not yet be complete if they have just recently been
 *   merged. After finding the PR, add it to the list of new PRs. Finding the first PR that exist in
 *   staging simply means checking if the PR is in the list of new refs.
 *
 * - Continuing from the found PR, find the first PR that does not exist in staging. While doing so,
 *   add all PRs that exist in staging to the list of new PRs. Similarly to the finding the first PR
 *   that exist in staging, finding the first PR that does not exist in staging simply means
 *   checking if the PR is _not_ in the list of new refs.
 *
 * - If the first PR that does not exist in staging is found, we are done and can return the list of
 *   new PRs. If not, we need to fetch the next batch of PRs and continue the process.
 */
 async function findNewPRs() {
  const repo = getRepoFromArguments();
  const newRefs = await fetchNewRefs(repo);

  if (newRefs.length === 0) {
    console.log('Production is the same as staging. Nothing to deploy.');
    process.exit();
  }

  const firstPRInStagingFound = false;
  const newPRs = [];
  let pullsRequestsPageNumber = 1;

  while (true) {
    const mergedPRs = await fetchMergedPRs(repo, pullsRequestsPageNumber);

    for (const { merge_commit_sha } of mergedPRs) {
      const pr = merge_commit_sha;

      if (newRefs.includes(pr)) {
        firstPRInStagingFound = true;
        newPRs.push(pr);
      } else {
        if (firstPRInStagingFound) return newPRs;
        // else, we are still searching for the first PR, hence just continue.
      }
    }

    // If we are here, we weren't able to find the first PR that does not exist in staging. Hence,
    // we need to fetch the next batch of merged PRs and repeat.
    pullsRequestsPageNumber++;
  }
}

async function main() {
  const newPRs = await findNewPRs();
}

main();
