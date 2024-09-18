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

const fetch = require('node-fetch');
const config = getConfig();
const octokit = new (require('octokit').Octokit)({ auth: config.token, request: {fetch} });
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

async function getPullRequestByCommitSha(sha) {
  const response =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: config.owner,
      repo: config.repo,
      commit_sha: sha,
    });
  // Unless I'm wrong, this should only ever be one PR per commit, to the master
  // branch. However, the API returns an array, so we'll just filter it to be
  // safe.
  const onlyToMaster = response.data.filter((pr) => pr.base.ref === "master");
  if (onlyToMaster.length === 0) {
    console.log(`No PRs found for commit ${sha}`);
    process.exit(1);
  }
  if (onlyToMaster.length > 1) {
    console.log(
      `Found ${onlyToMaster.length} PRs for commit ${sha}. There should only be one. Cancelling deployment. This suggests that something is wrong with the deployment script.`
    );
    process.exit(1);
  }
  return onlyToMaster[0];
}

/**
 * Find the pull requests that exist in staging, but not in production.
 */
async function displayNewPRs() {
  console.log(
    "Fetching the new pull requests since the last deployment to production.\n"
  );

  const newCommits = await fetchNewCommits();

  if (newCommits.length === 0) {
    console.log("Production is the same as staging. Nothing to deploy.");
    process.exit();
  }

  // Mutiple commits might be the same PR if it's a merge commit
  const uniquePRs = new Map(
    await Promise.all(
      newCommits.map(async (commit) => {
        const pr = await getPullRequestByCommitSha(commit.sha);
        return [pr.id, pr];
      })
    )
  );

  const prs = Array.from(uniquePRs.values()).sort((a, b) =>
    a.merged_at.localeCompare(b.merged_at)
  );

  const { cyanBright, green, grey } = require("chalk");
  const {
    DateTime: { fromISO, DATETIME_MED },
  } = require("luxon");

  const uniqueUsers = new Set();

  console.log(
    "Pull requests deployed to staging since the last deployment to production are:\n"
  );

  for (const [i, pr] of prs.entries()) {
    const userName = cyanBright(pr.user.login + ":");
    const mergeDate = green(fromISO(pr.merged_at).toLocaleString(DATETIME_MED));
    const shortSha = grey(pr.merge_commit_sha.slice(0, 7));
    const webUrl = grey(pr.html_url);

    uniqueUsers.add(pr.user.login);

    console.log(
      `(${i + 1}) ${userName} ${pr.title} (${shortSha}, ${mergeDate})`
    );
    console.log(`     ${webUrl}`);
  }

  console.log(
    `\nUnique User List[${uniqueUsers.size}]: ${Array.from(uniqueUsers).join(
      " "
    )}`
  );
}

/**
 * Get the list of commits that exist in staging, but do not exist in production. Since these are on
 * the default branch, all of these commits correspond to pull requests.
 */
async function fetchNewCommits() {
  try {
    const response = await octokit.rest.repos.compareCommits({
      owner: config.owner,
      repo: config.repo,
      base: 'production',
      head: 'master',
    });

    const {
      data: { commits },
    } = response;
    return commits;
  } catch (error) {
    throw new Error(`GitHub API request failed: ${error.message}`);
  }
}

async function promptForDeployment() {
  const prompt = require('prompt');

  prompt.message = '';
  prompt.start();

  const correctAnswer = 'approved';

  const { answer } = await prompt.get({
    name: 'answer',
    description: `\nPlease copy the text of the pull request list and post it to the #dev Slack channel, tagging every developer above. After getting their approval, type "${correctAnswer}" (without the quotes) and press return to continue the deployment`,
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
