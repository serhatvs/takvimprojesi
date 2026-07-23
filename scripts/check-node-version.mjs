const expectedNodeMajor = 24;
const expectedPnpmVersion = "11.16.0";
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
const userAgent = process.env.npm_config_user_agent ?? "";
const pnpmMatch = userAgent.match(/pnpm\/([^\s]+)/);

if (nodeMajor !== expectedNodeMajor) {
  console.error(
    `AGU Kampus Takvimi requires Node ${expectedNodeMajor}.x. Current Node is ${process.version}.`
  );
  console.error("Use a Node version manager, for example: nvm install 24 && nvm use 24");
  process.exit(1);
}

if (userAgent && !pnpmMatch) {
  console.error(`AGU Kampus Takvimi must be installed with pnpm ${expectedPnpmVersion}.`);
  console.error(`Use: corepack prepare pnpm@${expectedPnpmVersion} --activate`);
  process.exit(1);
}

if (pnpmMatch && pnpmMatch[1] !== expectedPnpmVersion) {
  console.error(
    `AGU Kampus Takvimi requires pnpm ${expectedPnpmVersion}. Current pnpm is ${pnpmMatch[1]}.`
  );
  console.error(`Use: corepack prepare pnpm@${expectedPnpmVersion} --activate`);
  process.exit(1);
}
