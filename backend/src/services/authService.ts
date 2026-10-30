import jwt from 'jsonwebtoken';
import { IAuthRepository, IUserRepository } from '../repositories/interfaces';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export class AuthService {
  constructor(
    private authRepository: IAuthRepository,
    private userRepository: IUserRepository
  ) {}

  async authenticateUser(login: string, password: string): Promise<string | null> {
    const authRecord = this.authRepository.findByLoginAndPassword(login, password);
    
    if (!authRecord) {
      return null;
    }

    const user = this.userRepository.findById(authRecord.userId);
    if (!user) {
      return null;
    }

    const payload = {
      userId: user.id,
      name: user.name,
      login: authRecord.login
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token: string): { userId?: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId?: string };
    } catch (error) {
      return null;
    }
  }
}
