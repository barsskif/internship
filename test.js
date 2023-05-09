const fs = require('fs');
const stylelint = require('stylelint');
const glob = require('glob');
const path = require('path');
const archiver = require('archiver');

function deleteFile(filePath) {
    const paths = fs.readFileSync('.stylelintignore-actual', 'utf-8').split('\n').filter(Boolean);
    fs.writeFileSync('.stylelintignore', paths.join('\n'));


    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Ошибка при удалении файла:', err);
        } else {
            console.log('Файл успешно удален!');
        }
    });
}

function copyAndArchiveFile(sourceFile, destinationFile) {
    // Копирование файла
    fs.copyFile(sourceFile, destinationFile, (err) => {
        if (err) {
            console.error('Ошибка при копировании файла:', err);
        } else {
            // Создание архива
            const archive = archiver('zip', { zlib: { level: 9 } });
            const output = fs.createWriteStream(`${destinationFile}.zip`);

            archive.pipe(output);
            archive.file(destinationFile, { name: 'file.txt' });
            archive.finalize();

            console.log('Файл успешно скопирован и заархивирован!');
            deleteFile('.stylelintignore-actual')
        }
    });
}

function isAllFiles(arr) {
    const fileRegex = /^[^/]*\.[a-zA-Z0-9]+$/; // Регулярное выражение для проверки имени файла

    return arr.every((item) => fileRegex.test(item));
}


function trimPathPrefix(path) {
    let trimmedPath;
    let removedPrefix;

    if (path.startsWith('src/components/')) {
        trimmedPath = path.replace(/^src\/components\//, '');
        removedPrefix = 'src/components/';
    } else if (path.startsWith('src/')) {
        trimmedPath = path.replace(/^src\//, '');
        removedPrefix = 'src/';
    }

    const isFileName = /^[^/]*$/.test(trimmedPath);

    return {
        path: trimmedPath,
        removedPrefix: removedPrefix,
        isFileName: isFileName
    };
}


function checkFilesInDirectories(fileObject) {
    const newArr = []

    for (var key in fileObject) {
        const dir = fileObject[key][0]['removedPrefix'] + fileObject[key][0]['path'].split('/')[0] + '/'
        const isRoorDir = fileObject[key][0]['isFileName']

        const filesInDirectory = fs.readdirSync(isRoorDir ? fileObject[key][0]['removedPrefix'] : dir.toString());


        if (filesInDirectory.length === fileObject[key].length) {
            const allFiles = isAllFiles(filesInDirectory);

            if (allFiles) {
                const item = fileObject[key][0]['removedPrefix'] + fileObject[key][0]['path'].split('/')[0] + '/*.css'
                newArr.push(item)
            } else {
                const item = fileObject[key][0]['removedPrefix'] + fileObject[key][0]['path'].split('/')[0] + '/**/*.css'
                newArr.push(item)
            }
        }


        if (filesInDirectory.length !== fileObject[key].length) {
            const item = fileObject[key].map(({ removedPrefix, path }) => `${removedPrefix}${path}`)
            newArr.push(...item)

        }
    }
    fs.writeFileSync('.stylelintignore-actual', newArr.join('\n'));
}


function getFilesByCommonDirectory() {
    const paths = fs.readFileSync('.stylelintignore-actual', 'utf-8').split('\n').filter(Boolean);

    const directories = {};

    for (let i = 0; i < paths.length; i++) {
        const file = trimPathPrefix(paths[i])

        const key = file.isFileName ? file.removedPrefix : `${file.path.split('/')[0]}`

        if (!directories[key]) {
            directories[key] = [];
        }

        directories[key].push(file)
    }

    checkFilesInDirectories(directories)
}


const isError = async (filePath) => {
    const fileContents = fs.readFileSync(filePath, 'utf-8');

    // Проверьте, есть ли в файле какие-либо ошибки
    const { errored } = await stylelint.lint({
        code: fileContents,
        configFile: '.stylelintrc.json',
        allowEmptyInput: true
    })

    return errored

}


async function processFilesInIgnore() {
    const currentIgnoreList = fs.readFileSync('.stylelintignore', 'utf-8').split('\n').filter(Boolean);
    const disableLinterRegex = /\/\*[\s\S]*?stylelint-disable[\s\S]*?\*\//;
    const srcDir = path.join(__dirname, 'src')
    const filesToCheck = glob.sync('**/*.css', { ignore: [...currentIgnoreList, '**/node_modules/**'], cwd: srcDir, nodir: true });

    const result = []

    for (let i = 0; i < filesToCheck.length; i++) {
        const file = filesToCheck[i]
        const fileContent = fs.readFileSync(`${srcDir}/${file}`, 'utf8');
        if (disableLinterRegex.test(fileContent)) {
            // файл содержит отключения linter мы не чего не делаем
        } else if (!disableLinterRegex.test(fileContent)) {
            // Файл не содержит общего правила отключения linter
            const err = await isError(`${srcDir}/${file}`)

            if (err) {
                result.push(`src/${file}`)
            }
        }
    }

    fs.writeFileSync('.stylelintignore-actual', result.join('\n'));

}


const start = async () => {

    console.log('Идет оптимизация',)
    const interval = setInterval(() => {
        process.stdout.write('.') // Вывод точки в консоль
    }, 500); // Задержка между точками (в миллисекундах)

    await processFilesInIgnore();


    getFilesByCommonDirectory();

    copyAndArchiveFile('.stylelintignore', 'stylelintignoreArchive')

    clearInterval(interval); // Остановка интервала

    console.log('\nОптимизация завершена');
};

start();