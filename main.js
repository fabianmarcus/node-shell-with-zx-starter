#! /usr/bin/env node

import { $ } from 'zx';

$.verbose = false;

const output = (await $`ls`).stdout.trim();

console.log(output);