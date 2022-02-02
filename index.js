const { readFileSync } = require('fs')
const { createTokenAuth } = require('@octokit/auth-token');

async function main () {
  // TODO: Get it from macOS Keychain.
  const accessToken = readFileSync('github-personal-access-token', 'utf-8');

  // console.log('accessToken is', accessToken);

  const auth = createTokenAuth(accessToken);
  const authentication = await auth();

  console.log(authentication);
}

main();
