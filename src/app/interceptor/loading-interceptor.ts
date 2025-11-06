import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

let activeRequests = 0;

export const loadingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Bỏ qua các request không cần loading
  if (req.url.includes('/api/auth/') || req.method === 'GET') {
    return next(req);
  }

  activeRequests++;
  
  // Hiển thị loading (có thể tích hợp với service loading)
  if (activeRequests === 1) {
    showLoading();
  }

  return next(req).pipe(
    finalize(() => {
      activeRequests--;
      if (activeRequests === 0) {
        hideLoading();
      }
    })
  );
};

function showLoading(): void {
  // Kiểm tra xem loading đã được thêm chưa
  if (document.getElementById('global-loading')) {
    return;
  }

  // Hiển thị loading spinner
  const loadingElement = document.createElement('div');
  loadingElement.id = 'global-loading';
  loadingElement.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.3);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      ">
        <div style="
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(loadingElement);
}

function hideLoading(): void {
  // Ẩn loading spinner
  const loadingElement = document.getElementById('global-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
}