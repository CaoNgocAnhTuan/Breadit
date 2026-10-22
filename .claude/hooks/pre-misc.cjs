#!/usr/bin/env node
'use strict';
/**
 * PreToolUse hook for Skill, SlashCommand, ScheduleWakeup, CronCreate, SendMessage and RemoteTrigger.
 * /approve and /freeze belong to the author. Claude may not start them itself, and may not
 * schedule or send a prompt that would start them.
 */
const h = require('./lib.cjs');

const USER_ONLY = ['approve', 'freeze'];
const input = h.readInput();
if (h.HARNESS_OFF) h.done();
const ti = input.tool_input || {};

if (input.tool_name === 'Skill' || input.tool_name === 'SlashCommand') {
  const name = String(ti.skill || ti.name || ti.command || '')
    .replace(/^\//, '')
    .split(/\s/)[0];
  if (USER_ONLY.includes(name)) h.deny(`/${name} is for the author only.`);
  h.done();
}

if (/(^|[^\w/])\/(approve|freeze)\b/.test(JSON.stringify(ti))) {
  h.deny('a scheduled or sent prompt cannot run /approve or /freeze; only the author types them.');
}
h.done();
