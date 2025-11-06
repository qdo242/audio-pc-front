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
  isLoading: boolean = false; // Sửa: không cần load lúc đầu
  private cartSubscription: Subscription | undefined;

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
        this.calculateTotal();
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
      return sum + (Number(item.price) * item.quantity); // Đảm bảo price là number khi tính
    }, 0);
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) {
      newQuantity = 1;
    }
    
    // SỬA: item.productId đã là string
    this.cartService.updateQuantityFrontend(item.productId, newQuantity).subscribe({
      next: () => {
        // Tự động cập nhật qua subscription
      },
      error: (error: any) => {
        console.error('Error updating quantity:', error);
        alert('Có lỗi xảy ra khi cập nhật số lượng!');
      }
    });
  }

  removeItem(productId: string): void {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?')) {
      // SỬA: productId đã là string
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

    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  getItemTotal(item: CartItem): number {
    return Number(item.price) * item.quantity;
  }

  loadRealData(): void {
    
    
    this.productService.getNewestProducts(4).subscribe({ 
      next: (data) => {
       
        this.productsToShow = data.map(p => ({
          ...p,
          
          imageUrl: p.image || (p.images && p.images.length > 0 ? p.images[0] : 'assets/images/default-product.png')
        }));
        console.log('Tải sản phẩm gợi ý thành công:', data);
      },
      error: (err) => {
        console.error('Lỗi khi tải sản phẩm gợi ý:', err);
      }
    });
  }
}