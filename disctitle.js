const exec = require('child_process').exec;

const get = async () => new Promise((resolve, reject) => {
	exec('wmic logicaldisk get volumename,caption /format:list', (err, stdout) => {
		if (err) {
			return reject(err);
		}
		const outs = stdout.split('\n').map(line => line.replace(/\r/g, '')).filter(line => line.length);
		const [header, info] = outs[outs.length - 1].split('=');
		resolve(info);
	});
});

module.exports = get;
