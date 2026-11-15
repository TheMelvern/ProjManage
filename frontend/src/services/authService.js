// Centralized session cleanup; preserve unrelated local preferences.
const SESSION_KEYS = ['access_token', 'auth_token', 'auth-token'];

export const authService = {
  async logout() {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    return { success: true };
  }
};
