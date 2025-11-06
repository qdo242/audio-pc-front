import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Đã có lỗi xảy ra';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Lỗi: ${error.error.message}`;
      } else {
        // Server-side error
        switch (error.status) {
          case 400:
            errorMessage = error.error?.message || 'Yêu cầu không hợp lệ';
            break;
          case 401:
            errorMessage = 'Phiên đăng nhập đã hết hạn';
            break;
          case 403:
            errorMessage = 'Bạn không có quyền truy cập';
            break;
          case 404:
            errorMessage = 'Không tìm thấy tài nguyên';
            break;
          case 409:
            errorMessage = error.error?.message || 'Dữ liệu đã tồn tại';
            break;
          case 500:
            errorMessage = 'Lỗi máy chủ';
            break;
          default:
            errorMessage = error.error?.message || `Lỗi: ${error.status}`;
        }
      }

      console.error('HTTP Error:', error);
      
      // Có thể hiển thị thông báo lỗi ở đây
      // showErrorNotification(errorMessage);

      return throwError(() => new Error(errorMessage));
    })
  );
};