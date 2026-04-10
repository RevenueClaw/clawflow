#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function printHelp() {
  console.log(`ClawFlow CLI Wrapper

Usage:
  clawflow <command> [options]

Commands:
  install <url-or-path>        Install a skill bundle
  agent create <name>          Create a new agent
  cron add <schedule> <cmd>    Add a cron job
  cron list                    List cron jobs
  cron remove <job-id>         Remove a cron job
  config init                  Initialize default configuration
  help                         Show this help message
`);
}

function fail(msg) {
  console.error('Error:', msg);
  process.exit(1);
}

function runCommand(cmd) {
  try {
    const out = execSync(cmd, { stdio: 'inherit' });
    return out;
  } catch (e) {
    fail(`Command failed: ${cmd}\n${e.message}`);
  }
}

function installSkill(target) {
  // Simple heuristic: if it's a git URL, clone; if it's a local path, copy.
  if (/^https?:\/\/.+/.test(target)) {
    const dest = path.join(process.cwd(), 'skills', path.basename(target, '.git'));
    if (fs.existsSync(dest)) fail(`Skill already exists at ${dest}`);
    runCommand(`git clone ${target} ${dest}`);
    console.log('Skill installed to', dest);
  } else {
    const src = path.resolve(target);
    if (!fs.existsSync(src)) fail(`Path ${src} does not exist`);
    const dest = path.join(process.cwd(), 'skills', path.basename(src));
    runCommand(`cp -r ${src} ${dest}`);
    console.log('Skill copied to', dest);
  }
}

function createAgent(name) {
  const agentsDir = path.join(process.cwd(), 'agents');
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir);
  const agentPath = path.join(agentsDir, name);
  if (fs.existsSync(agentPath)) fail(`Agent ${name} already exists`);
  fs.mkdirSync(agentPath);
  // minimal agent config
  const config = { name, version: '0.1.0', workspace: process.cwd() };
  fs.writeFileSync(path.join(agentPath, 'agent.json'), JSON.stringify(config, null, 2));
  console.log('Agent created at', agentPath);
}

function cronAdd(schedule, cmd) {
  const cronFile = path.join(process.cwd(), 'crontab.txt');
  const entry = `${schedule} ${cmd}\n`;
  fs.appendFileSync(cronFile, entry);
  console.log('Cron added:', entry.trim());
}

function cronList() {
  const cronFile = path.join(process.cwd(), 'crontab.txt');
  if (!fs.existsSync(cronFile)) { console.log('No cron jobs defined'); return; }
  const lines = fs.readFileSync(cronFile, 'utf-8').trim().split('\n');
  lines.forEach((l, i) => console.log(`${i+1}: ${l}`));
}

function cronRemove(id) {
  const cronFile = path.join(process.cwd(), 'crontab.txt');
  if (!fs.existsSync(cronFile)) fail('No cron file');
  const lines = fs.readFileSync(cronFile, 'utf-8').trim().split('\n');
  const idx = parseInt(id, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= lines.length) fail('Invalid job id');
  lines.splice(idx, 1);
  fs.writeFileSync(cronFile, lines.join('\n') + (lines.length ? '\n' : ''));
  console.log('Cron job', id, 'removed');
}

function configInit() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) fail('.env already exists');
  const defaultEnv = `# ClawFlow configuration\n# Add your variables here\n`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log('.env file created');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help') return printHelp();
  const cmd = args[0];
  switch (cmd) {
    case 'install':
      if (args.length < 2) fail('install requires a URL or path');
      installSkill(args[1]);
      break;
    case 'agent':
      if (args[1] !== 'create' || args.length < 3) fail('usage: agent create <name>');
      createAgent(args[2]);
      break;
    case 'cron':
      const sub = args[1];
      if (sub === 'add') {
        if (args.length < 4) fail('cron add requires <schedule> <command>');
        cronAdd(args[2], args.slice(3).join(' ');
      } else if (sub === 'list') {
        cronList();
      } else if (sub === 'remove') {
        if (args.length < 3) fail('cron remove requires <job-id>');
        cronRemove(args[2]);
      } else {
        fail('unknown cron subcommand');
      }
      break;
    case 'config':
      if (args[1] !== 'init') fail('usage: config init');
      configInit();
      break;
    default:
      fail('unknown command');
  }
}

main();
