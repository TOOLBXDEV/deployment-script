#!/usr/bin/env node

const fetch = require('node-fetch');
const { DateTime } = require('luxon');
const { WebClient } = require('@slack/web-api');

function getConfig() {
  const required = ['GITHUB_TOKEN', 'DEPLOY_OWNER', 'DEPLOY_REPO', 'DEPLOY_WORKFLOW_ID', 'DEPLOY_STAGING_REF', 'DEPLOY_PRODUCTION_REF', 'SLACK_BOT_TOKEN', 'SLACK_CHANNEL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.DEPLOY_OWNER,
    repo: process.env.DEPLOY_REPO,
    workflowId: process.env.DEPLOY_WORKFLOW_ID,
    stagingRef: process.env.DEPLOY_STAGING_REF,
    productionRef: process.env.DEPLOY_PRODUCTION_REF,
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
}

const config = getConfig();
const octokit = new (require('octokit').Octokit)({ auth: config.token, request: { fetch } });
const slack = new WebClient(config.slackBotToken);

main();

async function main() {
  const mode = process.argv[2];
  if (mode === 'list') {
    await listAndPost();
  } else if (mode === 'deploy') {
    await triggerDeploymentWorkflow();
  } else {
    console.error('Usage: deploy-ci.js <list|deploy>');
    process.exit(1);
  }
}

async function listAndPost() {
  console.log('Fetching new pull requests since last production deploy...');

  const newRefs = await fetchNewRefs();
  const prs = [];

  for (const ref of newRefs) {
    const pr = await getPullRequestByCommitSha(ref);
    prs.push({ ref, pr });
  }

  const slackUserIds = await resolveSlackUsers(prs);
  await postToSlack(prs, slackUserIds);
}

async function fetchNewRefs() {
  const exec = require('util').promisify(require('child_process').exec);

  const { stdout } = await exec(
    `./fetch-new-refs.sh ${config.owner} ${config.repo} ${config.stagingRef} ${config.productionRef}`
  );

  const trimmed = stdout.trim();
  if (!trimmed) {
    console.log('Production is the same as staging. Nothing to deploy.');
    process.exit(0);
  }

  return trimmed.split('\n');
}

async function getPullRequestByCommitSha(sha) {
  const response = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner: config.owner,
    repo: config.repo,
    commit_sha: sha,
  });
  const onlyToMaster = response.data.filter((pr) => pr.base.ref === 'master');
  if (onlyToMaster.length === 0) {
    console.log(`No PRs found for commit ${sha}`);
    process.exit(1);
  }
  if (onlyToMaster.length > 1) {
    console.log(`Found ${onlyToMaster.length} PRs for commit ${sha}. Expected one. Aborting.`);
    process.exit(1);
  }
  return onlyToMaster[0];
}

async function resolveSlackUsers(prs) {
  const uniqueLogins = [...new Set(prs.map(({ pr }) => pr.user.login))];
  const mapping = {};

  for (const login of uniqueLogins) {
    try {
      const { data: user } = await octokit.rest.users.getByUsername({ username: login });
      if (!user.email) continue;

      const result = await slack.users.lookupByEmail({ email: user.email });
      if (result.ok) {
        mapping[login] = result.user.id;
      }
    } catch (err) {
      console.log(`Could not resolve Slack user for ${login}: ${err.message}`);
    }
  }

  return mapping;
}

function formatSlackMention(login, slackUserIds) {
  return slackUserIds[login] ? `<@${slackUserIds[login]}>` : `@${login}`;
}

async function postToSlack(prs, slackUserIds) {
  const prLines = prs.map(({ ref, pr }, i) => {
    const mention = formatSlackMention(pr.user.login, slackUserIds);
    const date = DateTime.fromISO(pr.merged_at).toLocaleString(DateTime.DATETIME_MED);
    const shortSha = ref.slice(0, 7);
    return `${i + 1}. ${mention}: *${pr.title}* (\`${shortSha}\`, ${date})\n    ${pr.html_url}`;
  });

  const uniqueMentions = [...new Set(prs.map(({ pr }) => pr.user.login))]
    .map((login) => formatSlackMention(login, slackUserIds))
    .join(' ');

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🚀 Deploy ${config.owner}/${config.repo} to production`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*PRs included (${config.stagingRef} → ${config.productionRef}):*\n\n${prLines.join('\n\n')}`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Authors:* ${uniqueMentions}` },
    },
  ];

  await slack.chat.postMessage({
    channel: config.slackChannel,
    text: `Deploy ${config.owner}/${config.repo} to production — ${prs.length} PR(s)`,
    blocks,
  });

  console.log('Posted deploy summary to Slack.');
}

async function triggerDeploymentWorkflow() {
  await octokit.rest.actions.createWorkflowDispatch({
    owner: config.owner,
    repo: config.repo,
    workflow_id: config.workflowId,
    ref: config.stagingRef,
  });

  console.log(`Deployment dispatched. View progress: https://github.com/${config.owner}/${config.repo}/actions/workflows/${config.workflowId}`);
}
