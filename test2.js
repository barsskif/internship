const fs = require('fs');
const stylelint = require('stylelint');
const glob = require('glob');
const path = require('path');

const currentIgnoreList = fs.readFileSync('.stylelintignore', 'utf-8').split('\n').filter(Boolean);
const srcDir = path.join(__dirname, 'src');

const allCssFiles = [];

const updateStylelintignore = (nameFile) => {
    try {
        const data = fs.readFileSync('.stylelintignore', 'utf8');
        const updatedData = data.replace(nameFile.toString(), '');

        fs.writeFileSync('.stylelintignore', updatedData, 'utf8');
        console.log('Update stylelintignore');
    } catch (err) {
        console.error('Ошибка при записи файла: stylelintignore', err);
    }
};

function removeStylelintDisable(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const disableLinterRegex = /\/\*[\s\S]*?stylelint-disable[\s\S]*?\*\//;
        const updatedData = data.replace(disableLinterRegex, '');

        fs.writeFileSync(filePath, updatedData, 'utf8');
        console.log('Строка успешно удалена из файла!');
        updateStylelintignore(filePath);
    } catch (err) {
        console.error('Ошибка при записи файла:', err);
    }
}

const allFileCss = () => {
    const filesToCheck = glob.sync('**/*.css', { ignore: [...currentIgnoreList, '**/node_modules/**'], cwd: srcDir, nodir: true });
    allCssFiles.push(...filesToCheck.map((item) => `src/${item}`));
};

async function test(filePath) {
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { results, errored } = await stylelint.lint({
            code: fileContents,
            configFile: '.stylelintrc.json',
            syntax: 'css',
        });

        if (!errored) {
            return false;
        }

        const { line } = results[0].warnings[0];
        const disableLine = `/* stylelint-disable-next-line */`;

        const lines = fileContents.split('\n');
        const existingDisableLine = lines[line - 1].trim();

        if (existingDisableLine === disableLine) {
            return false;
        }

        lines.splice(line - 1, 0, disableLine);
        const modifiedData = lines.join('\n');

        fs.writeFileSync(filePath, modifiedData, 'utf8');
        console.log('Record added successfully!');
        updateStylelintignore(filePath);

        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

const lintFile = async (filePath) => {
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');

        const { errored } = await stylelint.lint({
            code: fileContents,
            configFile: '.stylelintrc.json',
            syntax: 'css',
        });
        removeStylelintDisable(filePath)

        if (errored) {

            await test(filePath);

        } else {
            console.log(`✅ ${filePath} В файле нет ошибок!`);
        }
    } catch (err) {
        console.error(err);
    }
};

const start = async () => {
    try {
        allFileCss();

        for (let i = 0; i < allCssFiles.length; i++) {
            await lintFile(allCssFiles[i]);
        }
    } catch (err) {
        console.log("🚀 =====> err:", err);
    }
};

start();
