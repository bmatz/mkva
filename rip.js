const log = require('bylog').create('ripper', {
	stdout: true,
});
const mkv = require('./mkv');
const readline = require('readline');
const exec = require('child_process').exec;
const mkdirp = require('mkdirp');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const rootFolder = 'x:\\bluray\\tng';

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

function next(targetFolder, tracks) {
	if (tracks.length) {
		const [track] = tracks;
		const { filesize, trackNr } = track.info;
		log.info(`Ripping Track ${trackNr} - ${filesize}`);
		const command = `makemkvcon64 --noscan mkv disc:0 ${trackNr} "${targetFolder}"`;
		execute(command)
		.then(() => {
			if (tracks.length > 1) {
				next(targetFolder, tracks.slice(1));
			}
		});
	}
}

async function run() {
	try {
		log.info('Season?');
		rl.question('', season => {
			log.info('Disc?');
			rl.question('', async disc => {
				rl.close();
				const targetFolder = `${rootFolder}\\s${season}\\d${disc}`;
				mkdirp(targetFolder);
				log.info(targetFolder);
				// log.info('Reading Disc Title');
				// const title = await disctitle();
				// log.info(`Disc: ${title}`);
				const trackData = await mkv.readDiscContent();
				trackData.forEach(track => {
					const { chapters, runtime, filesize, trackNr } = track.info;
					log.info(`Track ${trackNr}: ${filesize} - ${runtime}, ${chapters} Chapters`);
				});
				next(targetFolder, trackData);
			});
		});
	} catch (e) {
		console.error(e);
	}
}
run();
