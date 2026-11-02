import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { LoginRequest, LoginResponse } from '../types/entities';

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(req: Request<Record<string, never>, unknown, LoginRequest>, res: Response<LoginResponse | { error: string }>) {
    try {
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({ error: 'Login and password are required' });
      }

      const token = await this.authService.authenticateUser(login, password);

      if (!token) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const response: LoginResponse = { token };
      return res.status(200).json(response);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
