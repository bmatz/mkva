const log = require('bylog').create('renderer', {
	stdout: true,
});
const fs = require('fs');
const mkdirp = require('mkdirp');
const lookup = require('./episodes');
const exec = require('child_process').exec;


const config = {
	season: 1,
	root: 'x:\\bluray\\tng',
	target: '\\\\kerrigan\\data\\video\\serien\\star trek - the next generation',
	moveToTarget: true,
	moveToTargetInBackground: false,
	addTitle: true,
	addAttachment: true,
	mode: 'render', // copy, none
	autoRun: true,
};
config.fileRoot = `${config.root}\\s${config.season}`;
config.workingDir = `${config.fileRoot}\\working`;
config.originalDir = `${config.workingDir}\\original`;

function fileExists(filename) {
	try {
		const stat = fs.statSync(filename);
		return stat.isFile();
	} catch (e) {
		return false;
	}
}

function execute(command, message) {
	return new Promise((resolve, reject) => {
		exec(command, err => {
			if (err) {
				return reject(err);
			}
			if (message) {
				log.info(message);
			}
			resolve();
		});
	});
}

function prepare(filename) {
	mkdirp(config.workingDir);
	mkdirp(config.originalDir);
	const episode = filename.slice(0, 2);
	const info = lookup.episode(config.season, episode);
	info.originalFilePath = `${config.fileRoot}\\${filename}`;
	info.workingFilePath = `${config.originalDir}\\${filename}`;
	info.renderFilePath = `${config.workingDir}\\${filename}`;
	info.finishedFilePath = `${config.workingDir}\\${info.filename}`;
	info.targetFilePath = `${config.target}\\${info.filename}`;
	info.renderCommand =
		`HandBrakeCLI -i "${info.workingFilePath}" -t 1 --angle 1 -c 1-7 -o "${info.renderFilePath}" ` +
		'-f mkv  -w 1440 --crop 0:0:232:232 --loose-anamorphic  --modulus 2 -e x264 -q 23 ' +
		'--vfr -a 4,1 -E av_aac,av_aac -6 dpl2,7point1 -R 48,48 -B 160,256 -D 0,0 --gain 0,0 ' +
		'--audio-copy-mask mp3 --audio-fallback ac3 --subtitle 2,1 --markers="chapters.csv" ' +
		'--encoder-preset=veryfast  --encoder-tune="film"  --encoder-level="4.0"  --encoder-profile=main > nul';
	info.addTitleCommand = `mkvpropedit "${info.renderFilePath}" --edit info --set "title=${info.filetitle}"`;
	info.addAttachment = `mkvpropedit "${info.renderFilePath}" --add-attachment "${config.fileRoot}\\cover_land.jpg"`;
	info.movingCommand = `move "${info.finishedFilePath}" "${info.targetFilePath}"`;
	fs.renameSync(info.originalFilePath, info.workingFilePath);
	return info;
}

function render(info) {
	if (!config.mode || config.mode === 'none') {
		return Promise.resolve();
	} else if (config.mode === 'render') {
		log.info('rendering');
		return execute(info.renderCommand);
	} else if (config.mode === 'copy') {
		log.info('copying');
		fs.renameSync(info.workingFilePath, info.renderFilePath);
		return Promise.resolve();
	}
}

function finalize(info) {
	let addingTitleProm = Promise.resolve();
	if (config.addTitle) {
		log.info('adding title');
		addingTitleProm = execute(info.addTitleCommand);
	}
	return addingTitleProm
	.then(() => {
		let addingAttachmentProm = Promise.resolve();
		if (config.addAttachment) {
			log.info('adding attachment');
			addingAttachmentProm = execute(info.addAttachment);
		}
		return addingAttachmentProm;
	})
	.then(() => {
		fs.renameSync(info.renderFilePath, info.finishedFilePath);
		if (config.moveToTarget) {
			log.info(`moving to target${config.moveToTargetInBackground ? ' in background' : ''}`);
			const execProm = execute(info.movingCommand, `finished moving ${info.filename}`)
			.catch(err => {
				log.error(err);
			});
			if (config.moveToTargetInBackground) {
				return Promise.resolve();
			}
			return execProm;
		}
		return Promise.resolve();
	});
}

function getFirstFile(directory) {
	const files = fs.readdirSync(directory);
	const list = files.filter(file => file.endsWith('.mkv') && file.length === 6);
	if (list.length) {
		return list[0];
	}
	return '';
}

function run() {
	const files = fs.readdirSync(config.root);
	const seasonDirs = files.filter(file => file.length === 2 && file.toLowerCase().startsWith('s'));
	let dir = '';
	let file = '';
	seasonDirs.forEach(currentDir => {
		const checkingDir = `${config.root}\\${currentDir}`;
		const coverTargetPath = `${config.root}\\${currentDir}\\cover_land.jpg`;
		const coverSource = `${config.root}\\covers\\${currentDir}.jpg`;
		if (!fileExists(coverTargetPath)) {
			fs.createReadStream(coverSource).pipe(fs.createWriteStream(coverTargetPath));
		}
		if (!file) {
			file = getFirstFile(checkingDir);
			if (file) {
				dir = currentDir;
			}
		}
	});
	if (!dir || !file) {
		log.info('no file or directory found - probably finished');
	} else {
		config.season = dir.slice(1);
		config.fileRoot = `${config.root}\\${dir}`;
		config.workingDir = `${config.fileRoot}\\working`;
		config.originalDir = `${config.workingDir}\\original`;
		log.info(`working on ${dir}\\${file}`);
		const info = prepare(file);
		if (info) {
			log.info(info.filename);
			render(info)
			.then(() => finalize(info))
			.then(() => {
				if (config.autoRun) {
					setTimeout(() => run());
				}
			})
			.catch(err => {
				log.error(err);
			});
		}
	}
}

run();
