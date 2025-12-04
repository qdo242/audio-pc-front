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

  promoCode: string = '';
  discount: number = 0;
  appliedPromoCode: string = '';
  promoMessage: { type: 'success' | 'error', text: string } | null = null;

  constructor(
    private cartService: CartService,
    public authService: AuthService,
    private productService: ProductService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToCart();
    this.loadRealData();
    this.cartService.loadCart();
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) this.cartSubscription.unsubscribe();
  }

  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') return defaultPlaceholder;
    if (url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  }

  subscribeToCart(): void {
    this.isLoading = true;
    this.cartSubscription = this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        this.calculateTotal();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  calculateTotal(): void {
    this.total = this.cartItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    if (this.discount > 0 && this.total < this.discount) {
        this.discount = 0;
        this.appliedPromoCode = '';
        this.promoMessage = null;
    }
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) return;
    this.cartService.updateQuantityFrontend(item.productId, newQuantity).subscribe();
  }

  removeItem(productId: string): void {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?')) {
      this.cartService.removeFromCartFrontend(productId).subscribe();
    }
  }

  clearCart(): void {
    if (confirm('Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng?')) {
      this.cartService.clearCartFrontend().subscribe();
    }
  }

  applyPromoCode(): void {
    this.promoMessage = null;
    const code = this.promoCode.toUpperCase().trim();
    if (code === 'SALE10') {
      this.discount = this.total * 0.1;
      this.appliedPromoCode = 'SALE10';
      this.promoMessage = { type: 'success', text: 'Đã áp dụng mã giảm giá 10%!' };
    } else if (code === 'WELCOME5') {
      this.discount = 50000;
      this.appliedPromoCode = 'WELCOME5';
      this.promoMessage = { type: 'success', text: 'Đã áp dụng mã giảm 50,000đ!' };
    } else {
      this.discount = 0;
      this.appliedPromoCode = '';
      this.promoMessage = { type: 'error', text: 'Mã giảm giá không hợp lệ!' };
    }
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0) { alert('Giỏ hàng trống!'); return; }
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void { this.router.navigate(['/products']); }
  getItemTotal(item: CartItem): number { return Number(item.price) * item.quantity; }
  getGrandTotal(): number { const t = this.total - this.discount; return t < 0 ? 0 : t; }

  loadRealData(): void {
    this.productService.getNewestProducts(4).subscribe({
      next: (data) => {
        this.productsToShow = data.map(p => ({
          ...p,
          imageUrl: p.image || (p.images && p.images.length > 0 ? p.images[0] : '')
        }));
      }
    });
  }
}
