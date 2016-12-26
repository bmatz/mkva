const fs = require('fs');

class EpisodesLookup {
	constructor() {
		const content = fs.readFileSync('./tngepisodes.csv', 'UTF-8');
		const lines = content.split('\n');
		this.episodes = lines.map(line => {
			const [season, episode, number, stardate, premiereDe, premiereEn, titleDe, titleEn] = line.replace(/\r$/, '').split(';');
			return {
				season,
				episode,
				number,
				stardate,
				premiereDe,
				premiereEn,
				titleDe,
				titleEn,
				filename: `TNG - S0${season}E${episode} - ${stardate}.mkv`,
				filetitle: `S0${season}E${episode} - ${titleEn} / ${titleDe}`,
			};
		});
	}

	episode(season, nr) {
		if (nr) {
			return this.episodes.find(episode => episode.season == season && episode.episode == nr);
		}
		return this.episodes.filter(episode => episode.season == season);
	}

	get list() {
		return this.episodes;
	}

}

module.exports = new EpisodesLookup();
