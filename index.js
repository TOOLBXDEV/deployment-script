//
// Setup and Execution
//
const config = JSON.parse(require('fs').readFileSync('config.json', 'utf-8'));

function getRepoFromArguments() {
  const { repos } = config;
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

const repo = getRepoFromArguments();

// TODO: Store the access token more securely. For example, get it from macOS Keychain.
const octokit = new (require('octokit').Octokit)({ auth: config.token });
const baseOctokitArgs = {
  owner: config.organization,
  repo,
};

main();

//
// Helper Functions
//
async function main() {
  await displayNewPRs();
  await promptForDeployment();
}

/**
 * TODO: Mention how every commit in the default branch corresponds to a pull request, and change
 * the implementation accordingly.
 *
 * Find the PRs that are merged after the deployment to production, but before deployment to
 * staging. This way, we will understand which PRs will actually be deployed to production.
 *
 * To do so, starting from the latest merged PR and going back chronologically, we will:
 *
 * - Find the first PR that exists in staging. The first (couple) PRs are potentially not in
 *   staging, since their deployment to staging might not yet be complete if they have just recently
 *   been merged. After finding the PR, add it to the list of new PRs. Finding the first PR that
 *   exists in staging simply means checking if the PR is in the list of new refs.
 *
 * - Continuing from the found PR, find the first PR that does not exist in staging. While doing so,
 *   add all PRs that exist in staging to the list of new PRs. Similarly to the finding the first PR
 *   that exists in staging, finding the first PR that does not exist in staging simply means
 *   checking if the PR is _not_ in the list of new refs.
 *
 * - If the first PR that does not exist in staging is found, we are done and can return the list of
 *   new PRs. If not, we need to fetch the next batch of PRs and continue the process.
 */
 async function displayNewPRs() {
  console.log('Fetching the new pull requests since the last deployment to production.');

  const newRefs = await fetchNewRefs();
  const newPRs = [];
  let pullsRequestsPageNumber = 1;
  let firstPRInStagingFound = false;

  find_new_prs:
  while (true) {
    const mergedPRs = await fetchMergedPRs(pullsRequestsPageNumber);

    if (mergedPRs.length === 0) {
      console.log("No merged PRs found. This means that there is probably something wrong the repo. Cancelling deployment.");
      process.exit(1);
    }

    for (const pr of mergedPRs) {
      if (newRefs.includes(pr.merge_commit_sha)) {
        firstPRInStagingFound = true;
        newPRs.push(pr);
      } else {
        if (firstPRInStagingFound) break find_new_prs;
        // else, we are still searching for the first PR, hence just continue.
      }
    }
    // If we are here, we weren't able to find the first PR that does not exist in staging. Hence,
    // we need to fetch the next batch of merged PRs and repeat.
    pullsRequestsPageNumber++;
  }

  console.log('Pull requests deployed to staging since the last deployment to production are:\n');

  for (const pr of newPRs) {
    console.log(`- ${pr.user.login}: ${pr.title}`);
  }
}

/**
 * Get the list of commits that exist in staging, but do not exist in production. Since these are on
 * the default branch, all of these commits correspond to pull requests.
 */
 async function fetchNewRefs() {
  const exec = require('util').promisify(require('child_process').exec);

  const newRefs = (
    await exec(`./fetch-new-refs.sh ${config.organization} ${repo}`)
  ).stdout.trim().split('\n');

  if (newRefs.length === 0) {
    console.log('Production is the same as staging. Nothing to deploy.');
    process.exit();
  }

  return newRefs;
}

async function fetchMergedPRs(page) {
  return (await octokit.rest.pulls.list({
    ...baseOctokitArgs,
    state: 'closed',
    // 100 is the max value: https://docs.github.com/en/rest/reference/pulls#list-pull-requests
    per_page: 100,
    page,
  })).data.filter(({ merged_at }) => merged_at);
}

async function promptForDeployment() {
  const prompt = require('prompt');

  prompt.message = '';
  prompt.start();

  const correctAnswer = 'approved';

  const { answer } = await prompt.get({
    name: 'answer',
    description: `\nPlease take a screenshot of the pull requests and post it to the #dev Slack channel, tagging every developer above. After getting their approval, type "${correctAnswer}" (without the quotes) and press return to continue the deployment`,
  });

  if (answer !== correctAnswer) {
    console.log('Cancelling deployment.');
    process.exit(1);
  }

  console.log(`Deploying ${repo} to production.`);
  triggerDeploymentWorkflow();
}

async function triggerDeploymentWorkflow() {
  await octokit.rest.actions.createWorkflowDispatch({
    ...baseOctokitArgs,
    // TODO: Make this configurable
    workflow_id: 'deploy-to-production.yml',
    // TODO: Change this to 'staging'
    ref: 'master',
  });

  console.log(`Started deployment. You can view the progress at https://github.com/${config.organization}/${repo}/actions/workflows/deploy-to-production.yml`);
}
