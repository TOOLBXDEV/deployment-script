const { readFileSync } = require('fs')
const { Octokit } = require("octokit");

async function main () {
  // TODO: Store the access token more securely. For example, get it from macOS Keychain.
  const octokit = new Octokit({
    auth: readFileSync('github-personal-access-token', 'utf-8').trim()
  });

  const { data } = await octokit.rest.users.getAuthenticated();
  console.log(data);
}

main();
