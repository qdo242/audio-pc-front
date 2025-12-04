import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Product } from '../interfaces/product';
import { AuthService } from './auth';
import { ProductService } from './product'; // Import ProductService

export interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subTotal?: number;
  image: string;
}

export interface Cart {
  id?: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
}

interface CartItemRequest {
  productId: string;
  productName: string;
  price: string;
  quantity: number;
  image: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = 'http://localhost:8080/api/carts';
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private productService: ProductService // Inject để lấy ảnh
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) this.loadCart();
      else this.cartItemsSubject.next([]);
    });
  }

  private getCurrentUserId(): string {
    return this.authService.currentUserValue?.id || 'user123';
  }

  // --- LOGIC MỚI: LOAD CART KÈM ẢNH TỪ PRODUCT ---
  public loadCart(): void {
    const userId = this.getCurrentUserId();

    this.http.get<Cart>(`${this.apiUrl}/user/${userId}`).pipe(
      switchMap(cart => {
        if (!cart.items || cart.items.length === 0) {
          return of([]);
        }

        // Tạo danh sách các request lấy thông tin sản phẩm để lấy ảnh
        const productRequests = cart.items.map(item =>
          this.productService.getProductById(item.productId).pipe(
            map(product => {
              // Logic chọn ảnh giống hệt ProductDetail
              let imageUrl = product.image;
              if (!imageUrl && product.images && product.images.length > 0) {
                  imageUrl = product.images[0];
              }

              return {
                ...item,
                image: imageUrl || '' // Gán ảnh chuẩn từ Product vào CartItem
              };
            }),
            // Nếu lỗi (xoá sp rồi), giữ nguyên item cũ
            catchError(() => of(item))
          )
        );

        // Chạy song song tất cả request
        return forkJoin(productRequests);
      })
    ).subscribe({
      next: (itemsWithImages) => {
        this.cartItemsSubject.next(itemsWithImages);
      },
      error: (err) => {
        console.error('Load cart failed', err);
        this.cartItemsSubject.next([]);
      }
    });
  }

  getCartItems(): Observable<CartItem[]> {
    if (this.cartItemsSubject.value.length === 0) {
        this.loadCart();
    }
    return this.cartItems$;
  }

  // --- CÁC HÀM TƯƠNG TÁC ---

  addToCartFrontend(product: Product, quantity: number = 1): Observable<void> {
    const userId = this.getCurrentUserId();

    // Logic chọn ảnh để hiển thị ngay lập tức (Optimistic UI)
    let displayImage = product.image;
    if (!displayImage && product.images && product.images.length > 0) {
        displayImage = product.images[0];
    }

    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: quantity,
      image: displayImage || ''
    };

    const requestItem: CartItemRequest = {
      productId: cartItem.productId,
      productName: cartItem.productName,
      price: cartItem.price.toString(),
      quantity: cartItem.quantity,
      image: cartItem.image
    };

    return this.http.post<Cart>(`${this.apiUrl}/user/${userId}/items`, requestItem).pipe(
      tap(() => {
        // Sau khi thêm, load lại toàn bộ để đồng bộ chuẩn nhất
        this.loadCart();
      }),
      map(() => undefined)
    );
  }

  updateQuantityFrontend(productId: string, quantity: number): Observable<void> {
    const userId = this.getCurrentUserId();

    return this.http.put<Cart>(`${this.apiUrl}/user/${userId}/items/${productId}?quantity=${quantity}`, {}).pipe(
      tap(() => {
        // Cập nhật local state ngay để giao diện mượt
        const currentItems = this.cartItemsSubject.value;
        const itemIndex = currentItems.findIndex(item => item.productId === productId);
        if (itemIndex > -1) {
            currentItems[itemIndex].quantity = quantity;
            this.cartItemsSubject.next([...currentItems]);
        }
        // Load lại nền để đảm bảo đồng bộ giá/tồn kho
        this.loadCart();
      }),
      map(() => undefined)
    );
  }

  removeFromCartFrontend(productId: string): Observable<void> {
    const userId = this.getCurrentUserId();
    return this.http.delete<Cart>(`${this.apiUrl}/user/${userId}/items/${productId}`).pipe(
      tap(() => {
        const currentItems = this.cartItemsSubject.value;
        this.cartItemsSubject.next(currentItems.filter(i => i.productId !== productId));
      }),
      map(() => undefined)
    );
  }

  clearCartFrontend(): Observable<void> {
    const userId = this.getCurrentUserId();
    return this.http.delete<Cart>(`${this.apiUrl}/user/${userId}/clear`).pipe(
      tap(() => this.cartItemsSubject.next([])),
      map(() => undefined)
    );
  }

  getCartItemCountSync(): number {
    return this.cartItemsSubject.value.reduce((sum, item) => sum + item.quantity, 0);
  }
}
