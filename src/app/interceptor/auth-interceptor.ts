import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  
  // Thêm token vào header nếu có
  const token = authService.getToken();
  
  if (token && shouldAddToken(req)) {
    const authReq = addTokenHeader(req, token);
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return handle401Error(authReq, next, authService);
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};

function shouldAddToken(request: HttpRequest<unknown>): boolean {
  // Không thêm token cho các request public
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/verify-otp',
    '/api/auth/reset-password',
    '/api/products'
  ];

  // Cho phép tất cả request đến /api/products mà không cần token
  if (request.url.includes('/api/products')) {
    return false;
  }

  // Cho phép các request public
  if (publicEndpoints.some(endpoint => request.url.includes(endpoint))) {
    return false;
  }

  return true;
}

function addTokenHeader(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    headers: request.headers.set('Authorization', `Bearer ${token}`)
  });
}

function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  const token = authService.getToken();
  
  if (token) {
    return authService.refreshToken().pipe(
      switchMap((newToken: string) => {
        const newRequest = addTokenHeader(request, newToken);
        return next(newRequest);
      }),
      catchError((err) => {
        // Đăng xuất nếu refresh token thất bại
        authService.logout().subscribe();
        return throwError(() => err);
      })
    );
  }
  
  return throwError(() => new Error('No token available'));
}