#!/usr/bin/env node

import { Command } from 'commander';
import { generate, printInstructions, parseRepoArg } from './generator.js';

const program = new Command();

program
  .name('devcontainer-generator')
  .description('Generate devcontainer repositories with Claude Code sandbox')
  .option('--name <name>', 'Project name (derived from repo URL if omitted)')
  .option('--repo <url>', 'Git repository URL (repeatable, use #branch for per-repo branch)', (val, prev) => prev.concat([val]), [])
  .option('--branch <branch>', 'Git branch', 'main')
  .option('--stack <stack>', 'SDK/runtime stack (nodejs, python, dotnet)', 'nodejs')
  .option('--services <services>', 'Comma-separated services (postgres, mongo, redis, azurite)', '')
  .option('--full-internet', 'Allow full internet access (skip firewall)', false)
  .option('--include-compose', 'Include project docker-compose.yml via compose include', false)
  .option('--local-claude', 'Mount .claude from devcontainer repo (.project-claude/) instead of Docker volume', false)
  .option('--ssh-port <port>', 'SSH port for JetBrains IDE access (default: 2222)', '2222')
  .option('--port-prefix <prefix>', 'Port prefix for all exposed ports (e.g. 82 → SSH 8222, firewall 8280)')
  .requiredOption('--output <path>', 'Output directory path')
  .action((options) => {
    try {
      // Validace: min. 1 repo
      if (!options.repo || options.repo.length === 0) {
        console.error('Error: At least one --repo is required');
        process.exit(1);
      }

      const repos = options.repo.map(r => parseRepoArg(r, options.branch));
      const multiRepo = repos.length > 1;

      // Validace: --name povinný při multi-repo
      if (multiRepo && !options.name) {
        console.error('Error: --name is required when specifying multiple repositories');
        process.exit(1);
      }

      // Validace: unikátní repo názvy
      const repoNames = repos.map(r => r.name);
      const duplicates = repoNames.filter((n, i) => repoNames.indexOf(n) !== i);
      if (duplicates.length > 0) {
        console.error(`Error: Duplicate repository name '${duplicates[0]}' — each repo must have a unique basename`);
        process.exit(1);
      }

      // Odvození názvu pro single-repo
      if (!options.name) {
        options.name = repos[0].name;
      }

      const services = options.services ? options.services.split(',').map(s => s.trim()).filter(Boolean) : [];

      let sshPort, firewallPort;
      if (options.portPrefix) {
        sshPort = parseInt(options.portPrefix + '22', 10);
        firewallPort = parseInt(options.portPrefix + '80', 10);
      } else {
        sshPort = parseInt(options.sshPort, 10);
        firewallPort = 8180;
      }

      generate({ ...options, repos, multiRepo, services, sshPort, firewallPort });
      printInstructions(options.name, options.output, { localClaude: options.localClaude, sshPort, repos, multiRepo, includeCompose: options.includeCompose });
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
