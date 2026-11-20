import { describe, expect, it } from 'vitest';
import { createGame, getGame } from './api';
import { matchGame } from './router';



describe('matchGame : l\'URL → l\'id de partie', () => {

  it('reconnaît /partie/:id', () => {
    expect(matchGame('/partie/3')).toBe(3);
    expect(matchGame('/partie/42/')).toBe(42);
  });

  it('refuse tout le reste', () => {
    expect(matchGame('/')).toBeNull();
    expect(matchGame('/partie')).toBeNull();
    expect(matchGame('/partie/0')).toBeNull();
    expect(matchGame('/partie/abc')).toBeNull();
    expect(matchGame('/partie/3/extra')).toBeNull();
  });
});



describe('le faux serveur, vu du client', () => {

  it('une partie créée se recharge par son id, avec le même seed', async () => {
    const id = await createGame(1234);
    const game = await getGame(id);

    expect(game).toMatchObject({ id, seed: 1234 });
  });

  it('deux créations donnent deux ids différents', async () => {
    const a = await createGame();
    const b = await createGame();

    expect(a).not.toBe(b);
  });

  it('un id inconnu renvoie null (le 404)', async () => {
    expect(await getGame(999_999)).toBeNull();
  });
});
