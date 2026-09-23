import {beforeEach, describe, expect, it, vi} from 'vitest';
import {checkVersion} from './version-check';
import {fetchViaBackground} from './fetch/fetch';
import {storageSet} from './storage';
vi.mock('./fetch/fetch', () => ({fetchViaBackground: vi.fn()}));
beforeEach(() => storageSet('githubVersionCheck', null));
describe('GitHub updates', () => {
	it('проверяет релиз своего репозитория', async () => {
		vi.mocked(fetchViaBackground).mockResolvedValue({error: false, status: 200, text: '{"tag_name":"v5.5.0"}'});
		expect((await checkVersion()).latest).toBe('5.5.0');
		expect(fetchViaBackground).toHaveBeenCalledWith('https://api.github.com/repos/Samyray24/nmo-helper/releases/latest', expect.anything());
	});
	it('не выдаёт недоступность за актуальную версию', async () => {
		vi.mocked(fetchViaBackground).mockResolvedValue({error: true, status: 0, text: ''});
		expect(await checkVersion()).toMatchObject({unavailable: true, latest: ''});
	});
});
