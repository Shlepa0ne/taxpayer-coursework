// src/__mocks__/jwt-decode.js
const jwtDecode = jest.fn((token) => {
  if (token === 'mock-token') {
    return {
      user_id: 1,
      username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
  }
  if (token === 'invalid-token') {
    throw new Error('Invalid token');
  }
  return {};
});

export default jwtDecode;