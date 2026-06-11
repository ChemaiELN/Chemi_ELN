import { login, getMe } from '@/utilities/chemiaApi'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  username: string
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  // Step 1: obtain tokens
  const tokens = await login(payload.username, payload.password)
  localStorage.setItem('access_token', tokens.access_token)
  localStorage.setItem('refresh_token', tokens.refresh_token)

  // Step 2: fetch user profile using the new token
  const me = await getMe()
  localStorage.setItem('chemia_user', JSON.stringify(me))

  return {
    access_token: tokens.access_token,
    username: me.username,
  }
}
