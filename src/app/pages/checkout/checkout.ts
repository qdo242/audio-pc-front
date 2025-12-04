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
    fullName: '', email: '', phone: '', address: '', city: '',
    district: '', ward: '', country: 'Vietnam', zipCode: '100000', note: ''
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
    this.cartService.loadCart();
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) this.cartSubscription.unsubscribe();
  }

  // Hàm trackBy giúp Angular render danh sách ổn định, tránh lỗi hiển thị ảnh
  trackByFn(index: number, item: CartItem): string {
    return item.productId;
  }

  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') return defaultPlaceholder;
    if (url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  }

  loadCartItems(): void {
    this.isLoading = true;
    this.cartSubscription = this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        this.calculateTotals();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  prefillCustomerInfo(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.customerInfo.fullName = user.name;
      this.customerInfo.email = user.email;
      this.customerInfo.phone = user.phone || '';
      this.customerInfo.address = user.address || '';
    }
  }

  calculateTotals(): void {
    this.total = this.cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    this.grandTotal = this.total + this.shippingFee;
  }

  updateQuantityInCheckout(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) { this.removeItemFromCheckout(item); return; }
    this.cartService.updateQuantityFrontend(item.productId, newQuantity).subscribe();
  }

  removeItemFromCheckout(item: CartItem): void {
    if(confirm("Xóa sản phẩm này?")) {
        this.cartService.removeFromCartFrontend(item.productId).subscribe();
    }
  }

  placeOrder(): void {
    if (!this.validateForm()) return;
    if (this.cartItems.length === 0) { alert('Giỏ hàng trống!'); return; }

    const currentUserId = this.authService.currentUserValue?.id;
    if (!currentUserId) {
      alert('Vui lòng đăng nhập lại.');
      this.router.navigate(['/login']);
      return;
    }

    const shippingAddress: Address = {
      fullName: this.customerInfo.fullName,
      street: `${this.customerInfo.address}, ${this.customerInfo.ward}, ${this.customerInfo.district}`,
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
      next: () => {
        this.cartService.clearCartFrontend().subscribe(() => {
            this.isLoading = false;
            alert('🎉 Đặt hàng thành công!');
            this.router.navigate(['/']);
        });
      },
      error: () => { this.isLoading = false; alert('❌ Lỗi xử lý đơn hàng!'); }
    });
  }

  validateForm(): boolean {
    if (!this.customerInfo.fullName || !this.customerInfo.email || !this.customerInfo.phone || !this.customerInfo.address) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc (*)!');
        return false;
    }
    return true;
  }

  goBackToCart(): void { this.router.navigate(['/cart']); }
}
