const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');

/** Короткий стабильный отпечаток вопроса без хранения полного текста в служебных ключах. */
export function questionFingerprint(topic: string, question: string, variants: readonly string[]): string {
	const value = [normalize(topic), normalize(question), ...variants.map(normalize).sort()].join('\u241f');
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}
