import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface UploadResponse {
  success: boolean;
  message: string;
  url: string; // URL trả về từ backend (vd: /api/files/xxxxx)
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = 'http://localhost:8080/api/files';

  constructor(private http: HttpClient) { }

  /**
   * Tải file lên backend
   * @param file File cần upload
   * @returns Observable chứa URL của file đã upload
   */
  upload(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // Gửi POST request với FormData
    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }
}