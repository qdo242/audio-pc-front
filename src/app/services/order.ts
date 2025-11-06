import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Các interface gốc (dùng trong Angular, giữ kiểu number)
export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subTotal?: number;
  image?: string; // <-- THÊM DÒNG NÀY (tùy chọn)
}

export interface Address {
  fullName: string;
  street: string;
  city: string;
  country: string;
  zipCode: string;
  phone: string;
}

export interface Order {
  id?: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: 'CREDIT_CARD' | 'PAYPAL' | 'COD' | 'BANK_TRANSFER';
  shippingAddress: Address;
  createdAt?: string;
  updatedAt?: string;
}

// === Định nghĩa kiểu Request mới cho Backend (giá kiểu string, không có subTotal) ===
interface OrderItemRequest {
  productId: string;
  productName: string;
  price: string; // Đổi sang string
  quantity: number;
  image?: string; // Gửi cả ảnh
  // subTotal BỊ LOẠI BỎ
}

interface OrderRequest {
  id?: string;
  userId: string;
  items: OrderItemRequest[]; // Sử dụng interface request
  totalAmount: string; // Đổi sang string
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: 'CREDIT_CARD' | 'PAYPAL' | 'COD' | 'BANK_TRANSFER';
  shippingAddress: Address;
  createdAt?: string;
  updatedAt?: string;
}
// =======================================================

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:8080/api/orders';

  constructor(private http: HttpClient) { }

  // Các hàm GET giữ nguyên, nhận về Order (với number)
  getAllOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  getOrdersByUser(userId: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/user/${userId}`);
  }

  // Hàm POST được sửa để gửi đi OrderRequest (với string)
  createOrder(order: Order): Observable<Order> {
    // SỬA: Chuyển đổi Order (number) sang OrderRequest (string)
    const orderRequest: OrderRequest = {
      ...order,
      totalAmount: order.totalAmount.toString(), // Chuyển totalAmount sang string
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price.toString(), // Chuyển price sang string
        quantity: item.quantity,
        image: item.image // Gửi cả ảnh
        // Không gửi subTotal
      }))
    };
    
    // Gửi orderRequest (đã chuyển đổi)
    return this.http.post<Order>(this.apiUrl, orderRequest);
  }

  updateOrderStatus(id: string, status: Order['status']): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}/status?status=${status}`, {});
  }

  deleteOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getOrdersByStatus(status: Order['status']): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/status/${status}`);
  }
}