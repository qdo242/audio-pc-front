import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../services/cart';
import { AuthService } from '../../services/auth';
import { OrderService, Order, OrderItem, Address } from '../../services/order';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.scss']
})
export class Checkout implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  total: number = 0;
  shippingFee: number = 0; 
  grandTotal: number = 0;
  isLoading: boolean = true;

  customerInfo = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    ward: '',
    country: 'Vietnam',
    zipCode: '100000',
    note: ''
  };

  paymentMethod: 'COD' | 'CREDIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER' = 'COD'; 
  private cartSubscription: Subscription | undefined;

  constructor(
    private cartService: CartService,
    public authService: AuthService,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCartItems();
    this.prefillCustomerInfo();
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  loadCartItems(): void {
    this.isLoading = true; // Sửa: Đặt isLoading = true ở đây
    this.cartSubscription = this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        // Sửa: Nếu giỏ hàng rỗng, quay về trang giỏ hàng
        if (items.length === 0) {
          alert('Giỏ hàng của bạn đang trống!');
          this.router.navigate(['/cart']);
          return; // Dừng thực thi
        }
        this.calculateTotals();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading cart items:', error);
        this.isLoading = false;
      }
    });
  }

  prefillCustomerInfo(): void {
    if (this.authService.currentUserValue) {
      const user = this.authService.currentUserValue;
      this.customerInfo.fullName = user.name;
      this.customerInfo.email = user.email;
      this.customerInfo.phone = user.phone || '';
      this.customerInfo.address = user.address || '';
    }
  }

  calculateTotals(): void {
    this.total = this.cartItems.reduce((sum, item) => {
      return sum + (Number(item.price) * Number(item.quantity));
    }, 0);
    
    this.grandTotal = this.total + this.shippingFee;
  }

  // --- THÊM HÀM NÀY ---
  updateQuantityInCheckout(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) {
      this.removeItemFromCheckout(item); // Xóa nếu giảm xuống 0
      return;
    }
    
    this.cartService.updateQuantityFrontend(item.productId, newQuantity).subscribe({
      next: () => {
        // Giỏ hàng sẽ tự động cập nhật qua cartSubscription
        // và calculateTotals() sẽ được gọi
      },
      error: (error) => console.error('Error updating quantity:', error)
    });
  }

  // --- THÊM HÀM NÀY ---
  removeItemFromCheckout(item: CartItem): void {
    // Không cần confirm ở checkout, xóa luôn
    this.cartService.removeFromCartFrontend(item.productId).subscribe({
      next: () => {
        // Giỏ hàng sẽ tự động cập nhật qua cartSubscription
        // và calculateTotals() sẽ được gọi
        // Nếu xóa hết, loadCartItems() sẽ tự động điều hướng
      },
      error: (error) => console.error('Error removing item:', error)
    });
  }

  placeOrder(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.cartItems.length === 0) {
      alert('Giỏ hàng của bạn đang trống!');
      return;
    }

    const currentUserId = this.authService.currentUserValue?.id?.toString();
    if (!currentUserId) {
      alert('Lỗi xác thực người dùng. Vui lòng đăng nhập lại.');
      this.router.navigate(['/login']);
      return;
    }

    const shippingAddress: Address = {
      fullName: this.customerInfo.fullName,
      street: this.customerInfo.address + ', ' + this.customerInfo.district + ', ' + this.customerInfo.ward,
      city: this.customerInfo.city,
      country: this.customerInfo.country,
      zipCode: this.customerInfo.zipCode,
      phone: this.customerInfo.phone
    };

    const orderItems: OrderItem[] = this.cartItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
      subTotal: item.price * item.quantity, 
      image: item.image
    }));

    const newOrder: Order = {
      userId: currentUserId,
      items: orderItems,
      totalAmount: this.grandTotal,
      status: 'PENDING',
      paymentMethod: this.paymentMethod,
      shippingAddress: shippingAddress
    };

    this.isLoading = true;

    this.orderService.createOrder(newOrder).subscribe({
      next: (createdOrder) => {
        this.cartService.clearCartFrontend(currentUserId).subscribe({
          next: () => {
            this.isLoading = false;
            alert('🎉 Đặt hàng thành công! Cảm ơn bạn đã mua sắm tại AthenAudio.');
            this.router.navigate(['/']); 
          },
          error: (cartError) => {
            this.isLoading = false;
            console.error('Lỗi khi xóa giỏ hàng:', cartError);
            alert('Đặt hàng thành công nhưng có lỗi khi xóa giỏ hàng!');
            this.router.navigate(['/']); 
          }
        });
      },
      error: (orderError) => {
        this.isLoading = false;
        console.error('Error creating order:', orderError);
        alert('❌ Có lỗi xảy ra khi xử lý đơn hàng! Vui lòng thử lại.');
      }
    });
  }

  validateForm(): boolean {
    const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'district'];
    
    for (const field of requiredFields) {
      if (!this.customerInfo[field as keyof typeof this.customerInfo]) {
        alert(`Vui lòng điền đầy đủ thông tin ${this.getFieldLabel(field)}!`);
        return false;
      }
    }
    return true;
  }

  getFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      fullName: 'họ tên',
      email: 'email',
      phone: 'số điện thoại',
      address: 'địa chỉ',
      city: 'thành phố',
      district: 'quận/huyện'
    };
    return labels[field] || field;
  }

  

  goBackToCart(): void {
    this.router.navigate(['/cart']);
  }
}