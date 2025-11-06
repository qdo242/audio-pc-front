import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap } from 'rxjs';
import { Product } from '../interfaces/product';

// Interface dùng nội bộ trong Angular (có ảnh)
export interface CartItem {
  productId: string;
  productName: string;
  price: number; 
  quantity: number;
  subTotal?: number; 
  image: string; // <-- Quan trọng
}

// Interface dùng nội bộ trong Angular
export interface Cart {
  id?: string;
  userId: string;
  items: CartItem[];
  totalAmount: number; 
}

// Interface CHỈ DÙNG ĐỂ GỬI REQUEST (không có ảnh, giá là string)
// Backend không cần lưu ảnh giỏ hàng, nó chỉ cần biết ID
interface CartItemRequest {
  productId: string;
  productName: string;
  price: string; // Đổi sang string
  quantity: number;
  // subTotal BỊ LOẠI BỎ - Để backend tự tính
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = 'http://localhost:8080/api/carts';
  
  // Nguồn tin cậy (source of truth) cho giỏ hàng ở frontend (LUÔN CÓ ẢNH)
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===================================
  // HÀM GỌI API (Đã xử lý kiểu dữ liệu)
  // ===================================

  // Nhận về Cart (Backend không trả về ảnh)
  private getCartByUserAPI(userId: string): Observable<Cart> {
    return this.http.get<Cart>(`${this.apiUrl}/user/${userId}`);
  }

  // Gửi đi CartItemRequest (với price là string và không có subTotal)
  private addToCartAPI(userId: string, item: CartItem): Observable<Cart> {
    const requestItem: CartItemRequest = {
      productId: item.productId,
      productName: item.productName,
      price: item.price.toString(), // Chuyển sang string
      quantity: item.quantity
    };
    return this.http.post<Cart>(`${this.apiUrl}/user/${userId}/items`, requestItem);
  }

  private updateQuantityAPI(userId: string, productId: string, quantity: number): Observable<Cart> {
    return this.http.put<Cart>(`${this.apiUrl}/user/${userId}/items/${productId}?quantity=${quantity}`, {});
  }

  private removeFromCartAPI(userId: string, productId: string): Observable<Cart> {
    return this.http.delete<Cart>(`${this.apiUrl}/user/${userId}/items/${productId}`);
  }

  private clearCartAPI(userId: string): Observable<Cart> {
    return this.http.delete<Cart>(`${this.apiUrl}/user/${userId}/clear`);
  }

  // ===================================
  // HÀM DÙNG CHO COMPONENT (Quản lý State)
  // ===================================

  getCartItems(): Observable<CartItem[]> {
    return this.cartItems$;
  }

  addToCartFrontend(product: Product, quantity: number = 1, userId: string = 'user123'): Observable<void> {
    // 1. Tạo item đầy đủ (có ảnh)
    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: quantity,
      image: product.image // <-- Lấy ảnh từ product
    };

    return this.addToCartAPI(userId, cartItem).pipe(
      tap((cartFromBackend) => {
        // 2. Cập nhật BehaviorSubject
        const currentItems = this.cartItemsSubject.value;
        const existingItemIndex = currentItems.findIndex(i => i.productId === cartItem.productId);
        
        const itemFromBackend = cartFromBackend.items.find(i => i.productId === cartItem.productId);

        if (existingItemIndex > -1) {
          // Item đã tồn tại -> Cập nhật số lượng
          currentItems[existingItemIndex].quantity = itemFromBackend?.quantity || (currentItems[existingItemIndex].quantity + quantity);
          this.cartItemsSubject.next([...currentItems]);
        } else {
          // Item mới -> Thêm vào (lấy item từ backend và ghép ảnh vào)
          if (itemFromBackend) {
            // Gán ảnh vào item trả về từ backend
            const newItem: CartItem = { ...itemFromBackend, price: Number(itemFromBackend.price), image: cartItem.image };
            this.cartItemsSubject.next([...currentItems, newItem]);
          }
        }
      }),
      map(() => undefined) // Trả về void cho component
    );
  }

  removeFromCartFrontend(productId: string, userId: string = 'user123'): Observable<void> {
    return this.removeFromCartAPI(userId, productId).pipe(
      tap(() => {
        // Cập nhật BehaviorSubject: Xóa item
        const currentItems = this.cartItemsSubject.value;
        const newItems = currentItems.filter(item => item.productId !== productId);
        this.cartItemsSubject.next(newItems);
      }),
      map(() => undefined)
    );
  }

  updateQuantityFrontend(productId: string, quantity: number, userId: string = 'user123'): Observable<void> {
    return this.updateQuantityAPI(userId, productId, quantity).pipe(
      tap((cartFromBackend) => {
        // Cập nhật BehaviorSubject: Sửa số lượng
        const currentItems = this.cartItemsSubject.value;
        const itemIndex = currentItems.findIndex(item => item.productId === productId);
        
        if (itemIndex > -1) {
          const itemFromBackend = cartFromBackend.items.find(i => i.productId === productId);
          currentItems[itemIndex].quantity = itemFromBackend?.quantity || quantity;
          this.cartItemsSubject.next([...currentItems]);
        }
      }),
      map(() => undefined)
    );
  }

  clearCartFrontend(userId: string = 'user123'): Observable<void> {
    return this.clearCartAPI(userId).pipe(
      tap(() => {
        this.cartItemsSubject.next([]); // Xóa tất cả
      }),
      map(() => undefined)
    );
  }
  
  getCartItemCountSync(): number {
    const items = this.cartItemsSubject.value;
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  loadCartForUser(userId: string = 'user123'): void {
    // Tạm thời không load từ backend để giữ ảnh local,
    // Vì backend không lưu ảnh.
    // Khi backend lưu ảnh, hãy mở lại hàm này.
    /*
    this.getCartByUserAPI(userId).subscribe({
      next: (cart) => {
        // Không thể cập nhật subject vì cart.items từ backend không có ảnh
        // this.cartItemsSubject.next(cart.items); 
      },
      error: (error) => {
        console.error('Error loading cart:', error);
        this.cartItemsSubject.next([]); 
      }
    });
    */
  }
}