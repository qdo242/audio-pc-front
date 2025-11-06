import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { environment } from '../interfaces/enviroment';
import { LoginRequest, RegisterRequest, User, ProfileUpdateRequest, ChangePasswordRequest } from '../interfaces/user';

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
  token?: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser: User | null = null;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'currentUser';
  private apiUrl = environment.apiUrl;
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  // Getter cho currentUser
  get currentUserValue(): User | null {
    return this.currentUser;
  }

  // Getter cho trạng thái đăng nhập
  get isLoggedIn(): boolean {
    return !!this.currentUser && !!localStorage.getItem(this.TOKEN_KEY);
  }

  // Getter cho role
  get userRole(): string | null {
    return this.currentUser?.role || null;
  }

  // Getter cho tên user
  get userName(): string | null {
    return this.currentUser?.name || null;
  }

  // Getter cho email
  get userEmail(): string | null {
    return this.currentUser?.email || null;
  }

  private loadUserFromStorage(): void {
    const userData = localStorage.getItem(this.USER_KEY);
    const token = localStorage.getItem(this.TOKEN_KEY);
    
    if (userData && token) {
      this.currentUser = JSON.parse(userData);
      this.currentUserSubject.next(this.currentUser);
    }
  }

  private saveUserToStorage(user: User, token: string): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.TOKEN_KEY, token);
    this.currentUser = user;
    this.currentUserSubject.next(this.currentUser);
  }

  private clearStorage(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser = null;
    this.currentUserSubject.next(null);
  }

  // Đăng nhập
  login(loginData: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, loginData)
      .pipe(
        tap(response => {
          if (response.success && response.user && response.token) {
            this.saveUserToStorage(response.user, response.token);
          }
        })
      );
  }

  // Đăng ký
  register(registerData: RegisterRequest): Observable<AuthResponse> {
    const userData = {
      name: registerData.name,
      email: registerData.email,
      password: registerData.password,
      phone: registerData.phone || ''
    };

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, userData)
      .pipe(
        tap(response => {
          if (response.success && response.user && response.token) {
            this.saveUserToStorage(response.user, response.token);
          }
        })
      );
  }

  // Đăng xuất
  logout(): Observable<{ success: boolean; message: string }> {
    this.clearStorage();
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/logout`, {});
  }

  // Quên mật khẩu
  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // Xác thực OTP
  verifyOTP(email: string, otpCode: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/verify-otp`, { 
      email, 
      otpCode 
    });
  }

  // Đặt lại mật khẩu
// Đặt lại mật khẩu
resetPassword(email: string, otpCode: string, newPassword: string): Observable<ForgotPasswordResponse> {
  const requestBody = {
    email: email,
    otpCode: otpCode,
    newPassword: newPassword
  };

  console.log('📤 Sending reset password request:', { 
    email: email,
    otpCode: otpCode,
    newPasswordLength: newPassword.length
  });

  return this.http.post<ForgotPasswordResponse>(
    `${this.apiUrl}/auth/reset-password`, 
    requestBody
  ).pipe(
    tap(response => {
      console.log('📥 Reset password response:', response);
    })
  );
}

  // Cập nhật profile
  updateProfile(profileData: ProfileUpdateRequest): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.apiUrl}/users/${this.currentUser?.id}`, profileData)
      .pipe(
        tap(response => {
          if (response.success && response.user) {
            const token = this.getToken();
            if (token) {
              this.saveUserToStorage(response.user, token);
            }
          }
        })
      );
  }

  // Đổi mật khẩu
  changePassword(passwordData: ChangePasswordRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/change-password`, passwordData);
  }

  // Wishlist
  addToWishlist(productId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/users/${this.currentUser?.id}/wishlist/${productId}`, 
      {}
    ).pipe(
      tap(response => {
        if (response.success && this.currentUser) {
          if (!this.currentUser.wishlist) {
            this.currentUser.wishlist = [];
          }
          if (!this.currentUser.wishlist.includes(Number(productId))) {
            this.currentUser.wishlist.push(Number(productId));
            this.currentUserSubject.next(this.currentUser);
            localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
          }
        }
      })
    );
  }

  removeFromWishlist(productId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/users/${this.currentUser?.id}/wishlist/${productId}`
    ).pipe(
      tap(response => {
        if (response.success && this.currentUser?.wishlist) {
          this.currentUser.wishlist = this.currentUser.wishlist.filter(id => id !== Number(productId));
          this.currentUserSubject.next(this.currentUser);
          localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
        }
      })
    );
  }

  getWishlist(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/users/${this.currentUser?.id}/wishlist`);
  }

  // Helper methods
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAdmin(): Observable<boolean> {
    return of(this.currentUser?.role === 'admin');
  }

  isAdminSync(): boolean {
    return this.currentUser?.role === 'admin';
  }

  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    return this.currentUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Refresh user data từ server
  refreshUserData(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/email/${this.currentUser?.email}`)
      .pipe(
        tap(user => {
          const token = this.getToken();
          if (token) {
            this.saveUserToStorage(user, token);
          }
        })
      );
  }
refreshToken(): Observable<string> {
  const currentToken = this.getToken();
  
  // Mock implementation - trong thực tế sẽ gọi API
  return new Observable<string>(subscriber => {
    // Giả lập delay
    setTimeout(() => {
      if (currentToken) {
        // Trả về token mới (trong thực tế sẽ là token từ API)
        subscriber.next(currentToken + '-refreshed');
      } else {
        subscriber.error(new Error('No token to refresh'));
      }
      subscriber.complete();
    }, 1000);
  });
}


  
}

