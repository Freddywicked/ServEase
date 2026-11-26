import AsyncStorage from '@react-native-async-storage/async-storage';
import { me } from '../api/client';

describe('rolling mobile session', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a successful session check stores the renewed seven-day JWT', async () => {
    await AsyncStorage.setItem('token', 'previous-jwt');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'renewed-jwt',
        user: { user_id: 'user-1' },
        provider: null,
      }),
    });

    const data = await me();

    expect(data.user.user_id).toBe('user-1');
    expect(await AsyncStorage.getItem('token')).toBe('renewed-jwt');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer previous-jwt' }),
      })
    );
  });
});
