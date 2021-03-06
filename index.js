//
// Setup and Execution
//
function getConfig() {
  const EXPECTED_NUMBER_OR_ARGUMENTS = 6;

  // Remove the first two elements, since they are the file paths of the interpreter (Node.js) and program.
  process.argv.splice(0, 2);

  const numberOfArguments = process.argv.length;

  if (numberOfArguments !== EXPECTED_NUMBER_OR_ARGUMENTS) {
    console.error(`Expected ${EXPECTED_NUMBER_OR_ARGUMENTS} arguments but got ${numberOfArguments}. Please view the documentation to learn more about the program.`);
    process.exit(1);
  }

  return {
    token: process.argv[0],
    owner: process.argv[1],
    repo: process.argv[2],
    workflowId: process.argv[3],
    stagingRef: process.argv[4],
    productionRef: process.argv[5],
  };
}

const config = getConfig();
const octokit = new (require('octokit').Octokit)({ auth: config.token });
const baseOctokitArgs = {
  owner: config.owner,
  repo: config.repo
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
 * Find the pull requests that exist in staging, but not in production.
 *
 * The idea is, every commit on the default branch corresponds to a pull request, since a direct
 * push is not allowed to it. That is, any changes on the default branch can be made only through
 * pull requests.
 *
 * Keeping this in mind, to find out all pull requests that exist in staging but not in production,
 * we can:
 *
 * - Find out the commits between "staging" and "production" tags. Since the tags point to commits
 *   in the default branch, every such commit corresponds to a pull request. Hence, this gives us
 *   the pull requests that exist in staging, but not in production.
 *
 * - Fetch merged pull requests from GitHub and filter them by the refs that we discovered in the
 *   previous step.
 *
 * On another note, it might be possible to "improve the performance" (very very negligibly) by
 * assuming that the PRs fetched from GitHub will be in the same order of the ref order between the
 * "production" and "staging" tags. Although I believe that this is currently a correct assumption,
 * any "performance gains" would not be worth the risk of making the program less correct.
 *
 * However, if there was no such risk, the "performance improvement" would have been achieved as
 * follows: The first (couple) PRs fetched would possibly be the PRs that have just been merged and
 * hence, those PRs wouldn't even be in staging yet. So, starting from the latest PR, we would
 * search for the first PR that is in staging. After finding it, we would simply splice the PR array
 * as:
 *
 *  - Starting index: Index of the first PR that is in staging.
 *  - Ending index: Starting index + number of commits between staging and production.
 *
 * However, this is not too straightforward either, since an "edge case" is that the number of PRs
 * since the last deployment to production are very high, like almost 100. In that case, we would
 * need to fetch the next group of PRs and do the "splice" operation over two arrays. If the number
 * is even more, then we would need to do it over more arrays, etc. All of this extra cases that
 * need to be accommodated would increase the risk of introducing bugs.
 */
async function displayNewPRs() {
  console.log('Fetching the new pull requests since the last deployment to production.');

  const newRefs = await fetchNewRefs();
  const newPRs = [];
  let pullsRequestsPageNumber = 1;

  find_new_prs:
  while (true) {
    const mergedPRs = await fetchMergedPRs(pullsRequestsPageNumber);

    if (mergedPRs.length === 0) {
      console.log("No merged PRs found. This means that there is either something wrong the repo or with this program. Cancelling deployment.");
      process.exit(1);
    }

    for (const pr of mergedPRs) {
      if (newRefs.includes(pr.merge_commit_sha)) {
        newPRs.push(pr);

        if (newPRs.length === newRefs.length) break find_new_prs;
      }
    }
    // If we are here, we weren't able to find all PRs. Hence, we need to fetch the next batch of
    // merged PRs and repeat.
    pullsRequestsPageNumber++;
  }

  console.log('Pull requests deployed to staging since the last deployment to production are:\n');

  const { cyanBright, green }  = require('chalk')
  const { DateTime: { fromISO, DATETIME_MED} } = require('luxon');

  const uniqueUsers = new Set();

  for (let i = 0; i < newPRs.length; ++i) {
    const pr = newPRs[i];

    const userName = cyanBright(pr.user.login + ':');
    const mergeDate = green(fromISO(pr.merged_at).toLocaleString(DATETIME_MED));

    uniqueUsers.add(pr.user.login);

    console.log(`(${i + 1}) ${userName} ${pr.title} (${mergeDate})`);
  }

  console.log(`\nUnique User List[${uniqueUsers.size}]: ${Array.from(uniqueUsers).join(' ')}`);
}

/**
 * Get the list of commits that exist in staging, but do not exist in production. Since these are on
 * the default branch, all of these commits correspond to pull requests.
 */
async function fetchNewRefs() {
  const exec = require('util').promisify(require('child_process').exec);

  const newRefs = (
    await exec(`./fetch-new-refs.sh ${config.owner} ${config.repo} ${config.stagingRef} ${config.productionRef}`)
  ).stdout.trim();

  if (!newRefs) {
    console.log('Production is the same as staging. Nothing to deploy.');
    process.exit();
  }

  return newRefs.split('\n');
}

async function fetchMergedPRs(page) {
  return (await octokit.rest.pulls.list({
    ...baseOctokitArgs,
    state: 'closed',
    // 100 is the max value: https://docs.github.com/en/rest/reference/pulls#list-pull-requests
    per_page: 100,
    page,
    sort: 'updated',
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

  console.log(`Deploying ${config.repo} to production.`);
  await triggerDeploymentWorkflow();
}

async function triggerDeploymentWorkflow() {
  await octokit.rest.actions.createWorkflowDispatch({
    ...baseOctokitArgs,
    workflow_id: config.workflowId,
    ref: config.stagingRef,
  });

  console.log(`Started deployment. You can view the progress at https://github.com/${config.owner}/${config.repo}/actions/workflows/${config.workflowId}`);
}
