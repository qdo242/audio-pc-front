import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
// SỬA: Thêm Order
import { Order, OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { AccountSidebar } from '../../components/account-sidebar/account-sidebar';
// KHÔNG cần ProductService

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, AccountSidebar], 
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistory implements OnInit {
  orders: Order[] = [];
  isLoading: boolean = true;
  
  constructor(
    public authService: AuthService, // Để public cho HTML
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    const userId = this.authService.currentUserValue?.id;

    if (!userId) {
      this.isLoading = false;
      this.router.navigate(['/login']);
      return;
    }

    this.orderService.getOrdersByUser(userId).subscribe({
      next: (data) => {
        this.orders = data.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.isLoading = false;
      }
    });
  }

  
  
  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') {
      return defaultPlaceholder; // Sửa: Trả về ảnh mặc định cho đơn hàng cũ
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:8080${url}`; 
  }
  // ---------------------------------------------

  // SỬA: THÊM HÀM NÀY
  cancelOrder(orderId: string | undefined): void {
    if (!orderId) return;

    if (confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) {
      this.isLoading = true; // Hiển thị loading để người dùng biết
      this.orderService.updateOrderStatus(orderId, 'CANCELLED').subscribe({
        next: (updatedOrder) => {
          // Tải lại danh sách đơn hàng sau khi hủy
          this.loadOrders(); 
        },
        error: (err) => {
          console.error('Error cancelling order:', err);
          alert('Đã có lỗi xảy ra khi hủy đơn hàng.');
          this.isLoading = false;
        }
      });
    }
  }
  // KẾT THÚC THÊM HÀM

  // Helper để lấy text cho trạng thái
  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      PENDING: 'Chờ xử lý',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang xử lý',
      SHIPPED: 'Đã giao hàng',
      DELIVERED: 'Đã nhận',
      CANCELLED: 'Đã hủy'
    };
    return statusMap[status] || status;
  }

  // Helper để lấy class CSS cho trạng thái
  getStatusClass(status: string): string {
    return status.toLowerCase();
  }
}