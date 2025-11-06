import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Order, OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { AccountSidebar } from '../../components/account-sidebar/account-sidebar';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  // Thêm AccountSidebar và DatePipe
  imports: [CommonModule, RouterModule, DatePipe, AccountSidebar], 
  templateUrl: './order-detail.html',
  styleUrls: ['./order-detail.scss']
})
export class OrderDetail implements OnInit {
  order: Order | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadOrder();
  }

  loadOrder(): void {
    // Lấy ID từ URL
    const orderId = this.route.snapshot.paramMap.get('id');
    const userId = this.authService.currentUserValue?.id;

    if (!orderId) {
      this.errorMessage = 'Không tìm thấy ID đơn hàng.';
      this.isLoading = false;
      return;
    }

    // Gọi service để lấy chi tiết đơn hàng
    this.orderService.getOrderById(orderId).subscribe({
      next: (data) => {
        // Bảo mật: Đảm bảo đơn hàng này thuộc về người dùng đang xem
        if (data.userId !== userId && !this.authService.isAdminSync()) {
          this.errorMessage = 'Bạn không có quyền xem đơn hàng này.';
          this.isLoading = false;
        } else {
          this.order = data;
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error loading order:', err);
        this.errorMessage = 'Không thể tải chi tiết đơn hàng.';
        this.isLoading = false;
      }
    });
  }

  // Helper functions (sao chép từ order-history.ts)
  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') {
      return defaultPlaceholder;
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:8080${url}`; 
  }

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

  getStatusClass(status: string): string {
    return status.toLowerCase();
  }
}