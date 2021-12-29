#!./node_modules/.bin/ts-node

import path from 'path';
import which from 'which';
import { $, argv, cd, chalk, fs, question } from 'zx';


function exitWithError(msg) {
    console.trace(chalk.red(msg));
    process.exit(1);
}

async function checkDeps(list:Array<string>) {
    try {
        for(let dep of list) {
            await which(dep);
        }
    } catch(e) {
        exitWithError(e);
    }
}

async function getGlobGitSettingValue(name:string) {
    try {
        $.verbose = false;
        const setting = (await $`git config --global --get ${name}`).stdout.trim();
        $.verbose = true;
        return setting;
    } catch(e) {
        return '';
    }
}

async function checkGlobGitSettings(settings:Array<string>) {
    for(let setting of settings) {
        const value = await getGlobGitSettingValue(setting);
        if(!value) {
            console.warn(chalk.yellow(`Git setting ${setting} is not set`));
        }
    }
}

async function readPackageJson(dir:string) {
    const filepath = `${dir}/package.json`;
    return await fs.readJSON(filepath);
}

async function writePackageJson(dir:string, contents:string) {
    const filepath = `${dir}/package.json`;
    await fs.writeJSON(filepath, contents, { spaces: 2 });
}

async function promptForModSystem(systems:Array<string>) {
    const choice = await question(
        `Which Node.js module system do you want to use? (${systems.join(' or ')}): `, {
            choices: systems
        }
    );
    return choice;
}

async function getNodeModuleSystem() {
    const systems = ['module', 'commonjs'];
    const ms = await promptForModSystem(systems);

    if(!systems.includes(ms)) {
        console.error(chalk.red(`Choosen module system is invalid`));
        return await getNodeModuleSystem();
    }
    return ms;
}

async function promptForPackages() {
    const q = await question('Which npm packages do you want? ');
    const list = q.trim().split(' ').filter(pkg => pkg);
    return list;
}

async function checkForNpmPkg(pkglist) {
    $.verbose = false;

    const invalids = [];
    for(const pkg of pkglist) {
        try {
            await $`npm view ${pkg}`;
        } catch(e) {
            invalids.push(pkg);
        }
    }

    $.verbose = true;
    return invalids;
}

async function getPackagesToInstall() {
    const wanted = await promptForPackages();
    const invalids = await checkForNpmPkg(wanted);

    if(invalids.length > 0) {
        console.error(chalk.red(`Following packages do not exist: ${invalids.join(', ')}\n`));
        return await getPackagesToInstall();
    }
    return wanted;
}

async function generateReadme(dir) {
    const { name:projectName } = await readPackageJson(dir);
    const markdown = `# ${projectName}
        ...
    `;
    await fs.writeFile(`${dir}/README.md`, markdown);
}

async function createConfigFiles() {
    await $`npm install mrm mrm-task-editorconfig mrm-task-prettier mrm-task-eslint`;
    await $`npx gitignore node`;
    await $`npx mrm editorconfig`;
    await $`npx mrm prettier`;
    await $`npx mrm eslint`;
}


/**
 * Main
 */
(async () => {
    await checkDeps(['git', 'node', 'npx']);

    const dir = argv.directory;
    if(!dir) {
        exitWithError('No target directory given');
    }

    const dirpath = path.resolve(dir);
    if(!(await fs.pathExists(dir))) {
        await $`mkdir ${dirpath}`;
        // exitWithError('Given target directory does not exist');
    }

    cd(dirpath);
    console.log((await ($`ls`)).stdout.trim());

    await checkGlobGitSettings(['user.name', 'user.email']);
    await $`git init`;
    await $`npm init --yes`;

    const packageJson = await readPackageJson(dirpath);
    const systemChoice = await getNodeModuleSystem();

    packageJson.type = systemChoice;
    await writePackageJson(dirpath, packageJson);

    const packageList = await getPackagesToInstall();
    if(packageList.length > 0) {
        await $`npm install ${packageList}`;
    }
    await createConfigFiles();

    console.log(chalk.green(`\nThe project ${packageJson.name} has been successfully bootstrapped!\n`));
})();