const log = require('bylog').log;
const exec = require('child_process').exec;

function mapLine(linetype, data) {
	if (linetype === 'TINFO') {
		const [trackNr, info, code, text] = data;
		return {
			trackNr: parseInt(trackNr, 10),
			info: parseInt(info, 10),
			code: parseInt(code, 10),
			text: text.replace(/["\r]/g, ''),
		};
	}

	const [trackNr, element, info, code, text] = data;
	return {
		trackNr: parseInt(trackNr, 10),
		element: parseInt(element, 10),
		info: parseInt(info, 10),
		code: parseInt(code, 10),
		text: text.replace(/["\r]/g, ''),
	};
}

function parseContent(content) {
	const lines = content.split('\n');

	const mappedLines = lines.filter(line => line.startsWith('SINFO:') || line.startsWith('TINFO:'))
		.map(line => mapLine(line.slice(0, 5), line.slice(6).split(',')));

	const tracked = mappedLines.reduce((sum, curr) => {
		sum[curr.trackNr] = sum[curr.trackNr] || {};
		sum[curr.trackNr].lines = sum[curr.trackNr].lines || [];
		sum[curr.trackNr].lines.push(curr);
		return sum;
	}, {});

	let result = Object.keys(tracked).map(key => {
		const track = tracked[key];
		track.elements = track.lines.reduce((sum, curr) => {
			if (curr.hasOwnProperty('element')) {
				sum[curr.element] = sum[curr.element] || [];
				sum[curr.element].push(curr);
			}
			return sum;
		}, {});
		track.elements = Object.keys(track.elements).map(objKey => track.elements[objKey]);
		track.data = track.lines.filter(line => !line.hasOwnProperty('element'));
		delete track.lines;
		return track;
	});
	result = Object.keys(result).map(key => result[key]);
	result = result.map(track => {
		track.info = track.info || {};

		track.data.forEach(line => {
			track.info.trackNr = line.trackNr;
			switch (line.info) {
				case 8: track.info.chapters = line.text; break;
				case 9: track.info.runtime = line.text; break;
				case 10: track.info.filesize = line.text; break;
				case 11: track.info.bytes = line.text; break;
				case 27: track.info.filename = line.text; break;
				default: break;
			}
		});
		delete track.data;
		track.elements.forEach(element => {
			if (element.find(el => el.code === 6202)) {
				let audioElement = element.find(el => el.info === 3 && el.text === 'eng');
				if (audioElement) {
					if (element.find(sub => sub.text === 'DTS-HD MA')) {
						track.info.audioEn = { trackNr: audioElement.trackNr, element: audioElement.element };
					}
				}
				audioElement = element.find(el => el.info === 3 && el.text === 'deu');
				if (audioElement) {
					if (element.find(sub => sub.text === 'DD')) {
						track.info.audioDe = { trackNr: audioElement.trackNr, element: audioElement.element };
					}
				}
			}
			if (element.find(el => el.code === 6203)) {
				const subtitleElement = element.find(el => el.info === 3 && (el.text === 'eng' || el.text === 'deu'));
				if (subtitleElement) {
					track.info.subtitles = track.info.subtitles || [];
					track.info.subtitles.push({
						trackNr: subtitleElement.trackNr,
						element: subtitleElement.element,
						lang: subtitleElement.text,
					});
				}
			}
		});
		return track;
	});
	result = result.filter(track => track.info.bytes >= 7516192768 && track.info.bytes <= 16106127360);

	return Promise.resolve(result);
}

function readDiscContent() {
	return new Promise((resolve, reject) => {
		log.info('Reading Disc Content');
		exec('makemkvcon64 info disc:0 -r', (err, stdout, stderr) => {
			if (err) {
				return reject(err);
			}
			if (stderr) {
				return reject(stderr);
			}
			parseContent(stdout)
			.then(parsed => {
				resolve(parsed);
			})
			.catch(e => reject(e));
		});
	});
}

module.exports = {
	readDiscContent,
};
