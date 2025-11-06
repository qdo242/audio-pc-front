import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../services/cart';
import { AuthService } from '../../services/auth';
import { ProductService } from '../../services/product';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss']
})
export class Cart implements OnInit, OnDestroy {
  productsToShow: any[] = [];
  cartItems: CartItem[] = [];
  total: number = 0;
  isLoading: boolean = false; 
  private cartSubscription: Subscription | undefined;

  // --- THÊM CÁC BIẾN NÀY ---
  promoCode: string = '';
  discount: number = 0;
  appliedPromoCode: string = '';
  promoMessage: { type: 'success' | 'error', text: string } | null = null;
  // -------------------------

  constructor(
    private cartService: CartService,
    public authService: AuthService,
    private productService: ProductService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToCart();
    this.loadRealData(); 
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  subscribeToCart(): void {
    this.isLoading = true;
    this.cartSubscription = this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        this.calculateTotal(); // Sửa: Tính toán lại tổng
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading cart items:', error);
        this.isLoading = false;
      }
    });
  }

  calculateTotal(): void {
    this.total = this.cartItems.reduce((sum, item) => {
      return sum + (Number(item.price) * item.quantity); 
    }, 0);
    
    // Sửa: Áp dụng giảm giá
    if (this.discount > 0) {
      // Đảm bảo không giảm giá nhiều hơn tổng tiền
      if (this.total < this.discount) {
        this.discount = 0;
        this.appliedPromoCode = '';
        this.promoMessage = { type: 'error', text: 'Giỏ hàng không đủ điều kiện' };
      }
    }
    // Tổng cuối cùng là total - discount (nhưng total vẫn giữ nguyên)
  }

  // --- THÊM HÀM NÀY ---
  applyPromoCode(): void {
    this.promoMessage = null;
    
    // Đây là logic giả (mock). Trong thực tế, bạn sẽ gọi API
    if (this.promoCode.toUpperCase() === 'SALE10') {
      this.discount = this.total * 0.1; // Giảm 10%
      this.appliedPromoCode = 'SALE10';
      this.promoMessage = { type: 'success', text: 'Đã áp dụng mã giảm giá 10%!' };
    } else if (this.promoCode.toUpperCase() === 'WELCOME5') {
      this.discount = 50000; // Giảm 50,000đ
      this.appliedPromoCode = 'WELCOME5';
      this.promoMessage = { type: 'success', text: 'Đã áp dụng mã giảm 50,000đ!' };
    } else {
      this.discount = 0;
      this.appliedPromoCode = '';
      this.promoMessage = { type: 'error', text: 'Mã giảm giá không hợp lệ!' };
    }
    this.calculateTotal(); // Tính toán lại
  }
  // -------------------------

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) {
      newQuantity = 1;
    }
    
    this.cartService.updateQuantityFrontend(item.productId, newQuantity).subscribe({
      next: () => {
        // Tự động cập nhật qua subscription
        // calculateTotal() sẽ được gọi trong subscribeToCart
      },
      error: (error: any) => {
        console.error('Error updating quantity:', error);
        alert('Có lỗi xảy ra khi cập nhật số lượng!');
      }
    });
  }

  removeItem(productId: string): void {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?')) {
      this.cartService.removeFromCartFrontend(productId).subscribe({
        next: () => {
          // Tự động cập nhật qua subscription
        },
        error: (error: any) => {
          console.error('Error removing item:', error);
          alert('Có lỗi xảy ra khi xóa sản phẩm!');
        }
      });
    }
  }

  clearCart(): void {
    if (confirm('Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng?')) {
      this.cartService.clearCartFrontend().subscribe({
        next: () => {
          // Tự động cập nhật qua subscription
          this.discount = 0; // Xóa giảm giá khi xóa giỏ hàng
          this.promoCode = '';
          this.appliedPromoCode = '';
          this.promoMessage = null;
        },
        error: (error: any) => {
          console.error('Error clearing cart:', error);
          alert('Có lỗi xảy ra khi xóa giỏ hàng!');
        }
      });
    }
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0) {
      alert('Giỏ hàng của bạn đang trống!');
      return;
    }
    if (!this.authService.isLoggedIn) {
      alert('Vui lòng đăng nhập để tiếp tục thanh toán!');
      this.router.navigate(['/login']);
      return;
    }
    // TODO: Truyền mã giảm giá và số tiền giảm qua state
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  getItemTotal(item: CartItem): number {
    return Number(item.price) * item.quantity;
  }
  
  // Sửa: Lấy tổng tiền sau khi đã trừ giảm giá
  getGrandTotal(): number {
    const grandTotal = this.total - this.discount;
    return grandTotal < 0 ? 0 : grandTotal; // Đảm bảo tổng không bị âm
  }

  loadRealData(): void {
    this.productService.getNewestProducts(4).subscribe({ 
      next: (data) => {
        this.productsToShow = data.map(p => ({
          ...p,
          imageUrl: p.image || (p.images && p.images.length > 0 ? p.images[0] : 'assets/images/default-product.png')
        }));
      },
      error: (err) => {
        console.error('Lỗi khi tải sản phẩm gợi ý:', err);
      }
    });
  }

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
}