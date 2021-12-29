#!./node_modules/.bin/ts-node

import { $ } from 'zx';

$.verbose = false;

(async () => {
    const output = (await $`ls`).stdout.trim();
    console.log(output);
})();