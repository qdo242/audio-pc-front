import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { Product } from '../interfaces/product';

// Định nghĩa kiểu trả về chung từ backend
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  products?: T;
  product?: T;
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:8080/api/products';

  constructor(private http: HttpClient) { }

  // Lấy tất cả sản phẩm
  getAllProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(this.apiUrl)
      .pipe(map(response => response.products || []));
  }

  // Lấy sản phẩm bằng ID
  getProductById(id: string): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`${this.apiUrl}/${id}`)
      .pipe(map(response => response.product as Product));
  }

  // Tạo sản phẩm mới (SỬA: chấp nhận Partial<Product> để khớp với backend)
  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<ApiResponse<Product>>(this.apiUrl, product)
      .pipe(map(response => response.product as Product));
  }

  // Cập nhật sản phẩm
  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.http.put<ApiResponse<Product>>(`${this.apiUrl}/${id}`, product)
      .pipe(map(response => response.product as Product));
  }

  // Xóa sản phẩm (thực ra là cập nhật isActive = false)
  deleteProduct(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => undefined));
  }

  // Lấy sản phẩm theo Category
  getProductsByCategory(category: string): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/category/${category}`)
      .pipe(map(response => response.products || []));
  }

  // Lấy sản phẩm nổi bật
  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/featured`)
      .pipe(map(response => response.products || []));
  }
  
  // Lấy sản phẩm mới nhất
  getNewestProducts(limit: number = 8): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/newest?limit=${limit}`)
      .pipe(map(response => response.products || []));
  }
  
  // Lấy sản phẩm giảm giá
  getDiscountedProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/discounted`)
      .pipe(map(response => response.products || []));
  }

  // Tìm kiếm sản phẩm (chỉ theo keyword)
  searchProducts(query: string): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/search?q=${query}`)
      .pipe(map(response => response.products || []));
  }

  // --- Các method lọc client-side (Giữ lại vì backend chưa hỗ trợ lọc kết hợp) ---
  
  getBrands(): Observable<string[]> {
    return this.getAllProducts().pipe(
      map(products => {
        const brands = products.map(p => p.brand);
        const uniqueBrands = [...new Set(brands)].sort();
        return uniqueBrands;
      })
    );
  }

  getHeadphoneTypes(): Observable<string[]> {
    return this.getAllProducts().pipe(
      map(products => {
        const types = products
          .filter(p => p.category === 'headphone' && p.type)
          .map(p => p.type as string);
        const uniqueTypes = [...new Set(types)].sort();
        return uniqueTypes;
      })
    );
  }
}