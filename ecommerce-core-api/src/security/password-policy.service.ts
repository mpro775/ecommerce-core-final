import { Injectable, BadRequestException } from '@nestjs/common';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  score: number;
}

@Injectable()
export class PasswordPolicyService {
  private readonly minLength = 8;
  private readonly maxLength = 128;
  private readonly requireUppercase = true;
  private readonly requireLowercase = true;
  private readonly requireNumbers = true;
  private readonly requireSpecialChars = true;
  private readonly minSpecialChars = 1;
  private readonly specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  private readonly commonPasswords = new Set([
    'password',
    'password123',
    '123456',
    '12345678',
    'qwerty',
    'abc123',
    'monkey',
    'master',
    'dragon',
    'letmein',
    'admin',
    'administrator',
    'welcome',
    'welcome1',
    'password1',
    'iloveyou',
    'sunshine',
    'princess',
    'football',
    'baseball',
    'trustno1',
  ]);

  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      return {
        valid: false,
        errors: ['Password is required'],
        score: 0,
      };
    }

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Password must be at most ${this.maxLength} characters long`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requireSpecialChars) {
      const specialCharCount = [...password].filter((c) => this.specialChars.includes(c)).length;
      if (specialCharCount < this.minSpecialChars) {
        errors.push(
          `Password must contain at least ${this.minSpecialChars} special character (${this.specialChars})`,
        );
      }
    }

    if (this.containsCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    if (this.hasRepeatingChars(password)) {
      errors.push('Password contains too many repeating characters');
    }

    if (this.hasSequentialChars(password)) {
      errors.push('Password contains sequential characters');
    }

    const score = this.calculateScore(password, errors);

    return {
      valid: errors.length === 0,
      errors,
      score,
    };
  }

  validateOrThrow(password: string): void {
    const result = this.validate(password);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: result.errors,
        score: result.score,
      });
    }
  }

  generatePassword(length = 16): string {
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: this.specialChars,
    };

    let password = '';

    password += this.randomChar(charset.uppercase);
    password += this.randomChar(charset.lowercase);
    password += this.randomChar(charset.numbers);
    password += this.randomChar(charset.special);

    const allChars = Object.values(charset).join('');
    for (let i = password.length; i < length; i++) {
      password += this.randomChar(allChars);
    }

    return this.shuffleString(password);
  }

  private containsCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    for (const common of this.commonPasswords) {
      if (lowerPassword.includes(common)) {
        return true;
      }
    }
    return false;
  }

  private hasRepeatingChars(password: string, maxRepeat = 3): boolean {
    const lower = password.toLowerCase();
    let count = 1;

    for (let i = 1; i < lower.length; i++) {
      if (lower[i] === lower[i - 1]) {
        count++;
        if (count >= maxRepeat) {
          return true;
        }
      } else {
        count = 1;
      }
    }

    return false;
  }

  private hasSequentialChars(password: string, minLength = 4): boolean {
    const lower = password.toLowerCase();

    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'zyxwvutsrqponmlkjihgfedcba',
      '01234567890',
      '09876543210',
    ];

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - minLength; i++) {
        const subSeq = seq.substring(i, i + minLength);
        if (lower.includes(subSeq)) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateScore(password: string, errors: string[]): number {
    let score = 100;

    score -= errors.length * 15;

    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private randomChar(charset: string): string {
    const index = Math.floor(Math.random() * charset.length);
    return charset[index] ?? '';
  }

  private shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tempI = arr[i];
      const tempJ = arr[j];
      if (tempI !== undefined && tempJ !== undefined) {
        arr[i] = tempJ;
        arr[j] = tempI;
      }
    }
    return arr.join('');
  }
}
